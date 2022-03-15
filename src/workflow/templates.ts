import * as vscode from 'vscode';
import { StarterWorkflowTemplateDefinition, WorkflowCreationContext, WorkflowTemplateDefinition } from "../api/extension/api";
import { getGitHubContext, getGitHubContextForWorkspaceUri, GitHubRepoContext } from "../git/repository";
import { setSecret } from '../secrets';
import { getStarterWorkflowTemplates } from './starterWorkflows';
import { getWorkflowContributors } from './workflowContributors';

const starterDefinitions: { [key: string]: StarterWorkflowTemplateDefinition } = {};
const definitions: { [key: string]: WorkflowTemplateDefinition } = {};

let areStarterWorkflowsRegistered = false;

async function ensureStarterWorkflowsRegistered(): Promise<void> {
    if (areStarterWorkflowsRegistered) {
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Getting GitHub starter workflows...'
        },
        async () => {
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
                            const content = await template.getContent();

                            if (!content) {
                                throw new Error(`Could not get content for template '${template.id}'.`);
                            }

                            const definition = starterDefinitions[template.id];

                            if (definition) {
                                // Defer creation to registered template handler...
                                await definition.onCreate({ ...context, content });
                            } else {
                                // Create simple workflow from content...
                                await context.createWorkflowFromContent(template.suggestedFileName, content);
                            }

                        }
                    })
                });
                
                areStarterWorkflowsRegistered = true;
        });

    // TODO: Defer registration until user has selected a workflow.
    //       This requires a package.json mechanism for registering workflow template details.
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Registering extension workflows...'
        },
        async () => {
            const workflowContributors = getWorkflowContributors();

            function isValidExtension(extension: vscode.Extension<unknown> | undefined): extension is vscode.Extension<unknown> {
                return extension !== undefined;
            }

            const inactiveContributors =
                Object
                    .keys(workflowContributors)
                    .map (id => vscode.extensions.getExtension(id))
                    .filter(isValidExtension)
                    .filter(extension => !extension.isActive);

            await Promise.all(inactiveContributors.map(extension => extension.activate()));
        });
}

export function registerStarterWorkflowTemplate(definition: StarterWorkflowTemplateDefinition): vscode.Disposable {
    if (starterDefinitions[definition.id]) {
        throw new Error(`Starter workflow template with ID '${definition.id}' is already registered.`);
    }
    
    starterDefinitions[definition.id] = definition;

    return {
        dispose: () => {
            delete starterDefinitions[definition.id];
        }
    };
}

export function registerWorkflowTemplate(definition: WorkflowTemplateDefinition): vscode.Disposable {
    // TODO: Prevent extensions from registering templates with IDs that match those of starter templates (which are registered on-demand).
    if (definitions[definition.id]) {
        throw new Error(`Workflow template with ID '${definition.id}' is already registered.`);
    }

    definitions[definition.id] = definition;

    return {
        dispose: () => {
            delete definitions[definition.id];
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
        const template = definitions[templateId];

        if (!template) {
            throw new Error(`No template '${templateId}' is registered.`);
        }

        return template;
    } else {
        // TODO: Have well known groups (to protect against changes to ID or label over time)?
        const groupedTemplates = Object.values(definitions).reduce<{ [key: string]: { id: string, label: string, templates: WorkflowTemplateDefinition[] } }>(
            (previous, current) => {
                const group = previous[current.group.id] || { ...current.group, templates: [] };

                group.templates.push(current);

                previous[current.group.id] = group;

                return previous;
            },
            {});

        const items: (vscode.QuickPickItem & { template?: WorkflowTemplateDefinition })[] =
            Object
                .values(groupedTemplates)
                .sort((a, b) => a.label.localeCompare(b.label))
                .map(group => {
                    var separator: vscode.QuickPickItem = { label: group.label, kind: vscode.QuickPickItemKind.Separator };

                    return [separator].concat(
                        group
                            .templates
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map(template => ({ label: template.label, detail: template.description, template })));
                })
                .flatMap(groupItems => groupItems);

       
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
