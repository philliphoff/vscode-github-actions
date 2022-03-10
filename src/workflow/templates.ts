import * as vscode from 'vscode';
import { Octokit } from "@octokit/rest";
import path = require("path");
import { GitHubActionsApi, WorkflowCreationContext, WorkflowTemplateDefinition } from "../api/extension/api";
import { getGitHubContext, getGitHubContextForWorkspaceUri, GitHubRepoContext } from "../git/repository";
import { setSecret } from '../secrets';

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

const definitions: WorkflowTemplateDefinition[] = [];

export function registerWorkflowTemplate(definition: WorkflowTemplateDefinition): vscode.Disposable {
    definitions.push(definition);

    return {
        dispose: () => {
            const index = definitions.indexOf(definition);

            if (index >= 0) {
                definitions.splice(index, 1);
            }
        }
    };
}

async function selectWorkspace(): Promise<vscode.Uri | undefined> {
    if (vscode.workspace.workspaceFolders === undefined || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error("No workspace folder is open");
    } else if (vscode.workspace.workspaceFolders.length === 1) {
      return vscode.workspace.workspaceFolders[0].uri;
    } else {
      const selectedWorkspace = await vscode.window.showQuickPick(
        vscode.workspace.workspaceFolders.map(folder => ({ label: folder.name, folder })),
        {
          title: "Select a workspace folder to create the workflow in"
        });
  
      return selectedWorkspace?.folder?.uri;
    }
  }

export async function createWorkflowFromTemplate(context?: GitHubRepoContext, templateId?: string, callerContext?: never): Promise<void> {
    let gitHubRepoContext = context;

    const items = definitions.map(template => ({ label: template.title, description: template.description, template: template }));

    const selectedItem = await vscode.window.showQuickPick(items);

    if (!selectedItem) {
      return;
    }

    const workspaceUri = gitHubRepoContext?.workspaceUri ?? await selectWorkspace();

    if (!workspaceUri) {
      return;
    }

    if (!gitHubRepoContext) {
      gitHubRepoContext = await getGitHubContextForWorkspaceUri(workspaceUri);
    }

    if (selectedItem.template.onCreate) {
        await selectedItem.template.onCreate({
            callerContext,
            createWorkflowFromContent: async (suggestedFileName, content) => {
                const githubWorkflowsUri = vscode.Uri.joinPath(workspaceUri, ".github", "workflows");
                const workflowUri = vscode.Uri.joinPath(githubWorkflowsUri, suggestedFileName);
            
                // TODO: Account for name collisions.
            
                await vscode.workspace.fs.createDirectory(githubWorkflowsUri);
            
                await vscode.workspace.fs.writeFile(workflowUri, Buffer.from(content, 'utf8'));
            
                return {
                    succeeded: true,
                    result: workflowUri
                };
            },
            setSecret: async (suggestedName, value) => {
                if (!gitHubRepoContext) {
                    // TODO: Return failure?
                    throw new Error("No GitHub context available");
                }

                await setSecret(gitHubRepoContext, suggestedName, value);

                // TODO: Account for name collisions.

                return {
                    succeeded: true,
                    result: suggestedName
                };
            }
        });
    }
}

export async function registerWorkflowTemplates(): Promise<void> {
    // TODO: Get list of folders/files in actions repo (if cache expired).

    // TODO: Be passed context as argument.
    const gitHubContext = await getGitHubContext();

    if (!gitHubContext || gitHubContext.repos.length === 0) {
        return;
    }

    // TODO: Do we need the context to be repo-specific?
    //       What if the repo is not linked to GitHub yet?
    const gitHubRepoContext = gitHubContext.repos[0];

    const owner = 'actions';
    const repo = 'starter-workflows';

    const content = await gitHubRepoContext.client.repos.getContent(
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

    const downloadedTemplates = await Promise.all(files.map(file => getWorkflowTemplate(gitHubRepoContext.client, owner, repo, file)));

    const templates = downloadedTemplates.filter(isValidTemplate);

    templates.forEach(template => {
        registerWorkflowTemplate({
            id: template.id,
            title: template.properties.name,
            description: template.properties.description,

            onCreate: async (context: WorkflowCreationContext) => {
                await context.createWorkflowFromContent(template.suggestedFileName, template.content);
            }
        });
    });

    // TODO: Convert to local model.
    // TODO: Cache local model.
    // TODO: Register each template in the model.
}

async function getWorkflowTemplate(client: Octokit, owner: string, repo: string, file: GitHubDirectoryEntry): Promise<GitHubWorkflowTemplate | undefined> {
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