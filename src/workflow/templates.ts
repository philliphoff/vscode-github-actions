import * as vscode from 'vscode';
import { WorkflowCreationContext, WorkflowTemplateDefinition } from "../api/extension/api";
import { getGitHubContext, getGitHubContextForWorkspaceUri, GitHubRepoContext } from "../git/repository";
import { setSecret } from '../secrets';
import { getStarterWorkflowTemplates } from './starterWorkflows';

const definitions: WorkflowTemplateDefinition[] = [];

let areStarterWorkflowsRegistered = false;

async function ensureStarterWorkflowsRegistered(): Promise<void> {
    if (!areStarterWorkflowsRegistered) {
        // TODO: Be passed context as argument.
        const gitHubContext = await getGitHubContext();

        if (!gitHubContext || gitHubContext.repos.length === 0) {
            return;
        }

        // TODO: Do we need the context to be repo-specific?
        //       What if the repo is not linked to GitHub yet?
        const client = gitHubContext.repos[0].client;

        const starterWorkflowTemplates = await getStarterWorkflowTemplates(client);
        
        starterWorkflowTemplates.forEach(
            template => {
                registerWorkflowTemplate({
                    description: template.properties.description,
                    group: template.group,
                    id: template.id,
                    label: template.properties.name,
        
                    onCreate: async (context: WorkflowCreationContext) => {
                        await context.createWorkflowFromContent(template.suggestedFileName, template.content);
                    }
                })        
            });
        
        areStarterWorkflowsRegistered = true;
    }
}

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

async function getWorkflowTemplate(templateId: string | undefined): Promise<WorkflowTemplateDefinition | undefined> {
    if (templateId) {
        const template = definitions.find(definition => definition.id === templateId);

        if (!template) {
            throw new Error(`No template '${templateId}' is registered.`);
        }

        return template;
    } else {
        const items = definitions.map(template => ({ label: template.label, detail: template.description, template }));
        
        const selectedItem = await vscode.window.showQuickPick(items);
        
        return selectedItem?.template;
    }
}

export async function createWorkflowFromTemplate(context?: GitHubRepoContext, templateId?: string, callerContext?: never): Promise<void> {
    await ensureStarterWorkflowsRegistered();

    let gitHubRepoContext = context;

    const template = await getWorkflowTemplate(templateId);

    if (!template) {
      return;
    }

    const workspaceUri = gitHubRepoContext?.workspaceUri ?? await selectWorkspace();

    if (!workspaceUri) {
      return;
    }

    if (!gitHubRepoContext) {
      gitHubRepoContext = await getGitHubContextForWorkspaceUri(workspaceUri);
    }

    if (template.onCreate) {
        await template.onCreate({
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
