import { Octokit } from "@octokit/rest";
import path = require("path");

interface GitHubDirectoryEntry {
    readonly name: string;
    readonly path: string;
    readonly type: 'directory' | 'file';
}

interface GitHubFileContent {
    readonly data: {
        readonly content?: string | undefined;
    }
}

interface GitHubDirectoryContent {
    readonly data: GitHubDirectoryEntry[];
}

export interface GitHubWorkflowTemplateProperties {
    readonly name: string;
    readonly description: string;
    readonly creator: string;
    readonly iconName: string;
    readonly categories: string[];
}

export interface GitHubWorkflowTemplate {
    readonly group: string;
    readonly id: string;
    readonly properties: GitHubWorkflowTemplateProperties;
    readonly suggestedFileName: string;

    getContent(): Promise<string | undefined>;
}

let starterWorkflowTemplates: GitHubWorkflowTemplate[] | undefined;

const groups = [ 'ci', 'deployments', 'automation', 'code-scanning'];

export async function getStarterWorkflowTemplates(client: Octokit): Promise<GitHubWorkflowTemplate[]> {
    if (starterWorkflowTemplates) {
        return starterWorkflowTemplates;
    }

    // TODO: Refresh only if cache expired.

    const allTemplates = await Promise.all(groups.map(group => getStarterWorkflowTemplatesForGroup(client, group)));

    starterWorkflowTemplates = allTemplates.flatMap(templates => templates);

    // TODO: Cache local model.

    return starterWorkflowTemplates;
}

async function getStarterWorkflowTemplatesForGroup(client: Octokit, group: string): Promise<GitHubWorkflowTemplate[]> {
    if (starterWorkflowTemplates) {
        return starterWorkflowTemplates;
    }

    const owner = 'actions';
    const repo = 'starter-workflows';

    const content = await client.repos.getContent(
        {
            owner,
            repo,
            path: `${group}/properties`
        }) as GitHubDirectoryContent;

    function isFile(entry: GitHubDirectoryEntry): boolean {
        return entry.type === 'file';
    }

    const files = content.data.filter(isFile);

    function isValidTemplate(template: GitHubWorkflowTemplate | undefined): template is GitHubWorkflowTemplate {
        return template !== undefined;
    }

    const downloadedTemplates = await Promise.all(files.map(file => getStarterWorkflowTemplate(client, owner, repo, group, file)));

    starterWorkflowTemplates = downloadedTemplates.filter(isValidTemplate);

    // TODO: Cache local model.

    return starterWorkflowTemplates;
}

async function getStarterWorkflowTemplate(client: Octokit, owner: string, repo: string, group: string, file: GitHubDirectoryEntry): Promise<GitHubWorkflowTemplate | undefined> {
    const propertiesContent = await getFileContent(client, owner, repo, file.path);

    if (!propertiesContent) {
        return undefined;
    }

    const properties = JSON.parse(propertiesContent) as GitHubWorkflowTemplateProperties;

    const basename = path.basename(file.name, '.properties.json');

    const templateDir = path.dirname(path.dirname(file.path));
    const templatePath = path.join(templateDir, basename + '.yml');

    return {
        group,
        id: path.join(templateDir, basename),
        properties,
        suggestedFileName: basename + '.yml',

        getContent:
            async () => {
                // TODO: Cache content?
                return await getFileContent(client, owner, repo, templatePath);
            }
    };
}

async function getFileContent(client: Octokit, owner: string, repo: string, path: string): Promise<string | undefined> {
    const content = await client.repos.getContent(
        {
            owner,
            repo,
            path
        }) as GitHubFileContent;

    if (!content.data?.content) {
        // TODO: Log unexpected lack of content.
        return undefined;
    }

    return Buffer.from(content.data.content, 'base64').toString('utf8');
}