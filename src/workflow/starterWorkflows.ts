import { Octokit } from "@octokit/rest";
import path = require("path");

interface GitHubDirectoryEntry {
    name: string;
    path: string;
    type: 'directory' | 'file';
}

interface GitHubFileContent {
    data: {
        content?: string | undefined;
    }
}

interface GitHubDirectoryContent {
    data: GitHubDirectoryEntry[];
}

interface GitHubWorkflowTemplateProperties {
    name: string;
    description: string;
    creator: string;
    iconName: string;
    categories: string[];
}

interface GitHubWorkflowTemplate {
    id: string;
    properties: GitHubWorkflowTemplateProperties;
    content: string;
    suggestedFileName: string;
}

let starterWorkflowTemplates: GitHubWorkflowTemplate[] | undefined;

export async function getStarterWorkflowTemplates(client: Octokit): Promise<GitHubWorkflowTemplate[]> {
    if (starterWorkflowTemplates) {
        return starterWorkflowTemplates;
    }

    // TODO: Refresh only if cache expired.

    const owner = 'actions';
    const repo = 'starter-workflows';

    const content = await client.repos.getContent(
        {
            owner,
            repo,
            path: 'deployments/properties'
        }) as GitHubDirectoryContent;

    function isFile(entry: GitHubDirectoryEntry): boolean {
        return entry.type === 'file';
    }

    const files = content.data.filter(isFile);

    function isValidTemplate(template: GitHubWorkflowTemplate | undefined): template is GitHubWorkflowTemplate {
        return template !== undefined;
    }

    const downloadedTemplates = await Promise.all(files.map(file => getStarterWorkflowTemplate(client, owner, repo, file)));

    starterWorkflowTemplates = downloadedTemplates.filter(isValidTemplate);

    // TODO: Cache local model.

    return starterWorkflowTemplates;
}

async function getStarterWorkflowTemplate(client: Octokit, owner: string, repo: string, file: GitHubDirectoryEntry): Promise<GitHubWorkflowTemplate | undefined> {
    const propertiesContent = await getFileContent(client, owner, repo, file.path);

    if (!propertiesContent) {
        return undefined;
    }

    const properties = JSON.parse(propertiesContent) as GitHubWorkflowTemplateProperties;

    const basename = path.basename(file.name, '.properties.json');

    const templateDir = path.dirname(path.dirname(file.path));
    const templatePath = path.join(templateDir, basename + '.yml');

    // TODO: Wait until needed (i.e. store path in model).
    const templateContent = await getFileContent(client, owner, repo, templatePath);

    if (!templateContent) {
        return undefined;
    }

    return {
        content: templateContent,
        id: path.join(templateDir, basename),
        properties,
        suggestedFileName: basename + '.yml'
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