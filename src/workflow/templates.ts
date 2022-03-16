import * as vscode from 'vscode';
import { GitHubWorkflowProvider, WorkflowCreationContext } from "../api/extension/api";
import { getGitHubContext, getGitHubContextForWorkspaceUri, GitHubRepoContext } from "../git/repository";
import { setSecret } from '../secrets';
import { getStarterWorkflowTemplates, GitHubWorkflowTemplate } from './starterWorkflows';
import { activateExtensionForWorkflow, getCustomWorkflows } from './workflowContributors';

let starterDefinitions: GitHubWorkflowTemplate[];

const workflowProviders: { [key: string]: GitHubWorkflowProvider } = {};

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
            
            starterDefinitions = await getStarterWorkflowTemplates(client);

            areStarterWorkflowsRegistered = true;
        });
}

export function registerWorkflowProvider(type: string, provider: GitHubWorkflowProvider): vscode.Disposable {
    // TODO: Prevent extensions from registering templates with IDs that match those of starter templates (which are registered on-demand).
    if (workflowProviders[type]) {
        throw new Error(`A workflow provider for type '${type}' is already registered.`);
    }

    workflowProviders[type] = provider;

    return {
        dispose: () => {
            delete workflowProviders[type];
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

async function getWorkflowProvider(type: string): Promise<GitHubWorkflowProvider | undefined> {
    await activateExtensionForWorkflow(type);

    return workflowProviders[type];
}

function createStarterWorkflowProvider(template: GitHubWorkflowTemplate): GitHubWorkflowProvider {
    return {
        createWorkflow: async (context: WorkflowCreationContext): Promise<void> => {
            const content = context.content ?? await template.getContent();

            if (!content) {
                throw new Error(`Could not get content for template '${template.id}'.`);
            }

            const workflowProvider = await getWorkflowProvider(template.id);

            if (workflowProvider) {
                workflowProvider.createWorkflow({ ...context, content });
            } else {
                context.createWorkflowFromContent(template.suggestedFileName, content);
            }
        }
    };
}

const groupLabels: { [key: string]: string } = {
    'ci': 'Continuous Integration',
    'deployments': 'Deployment',
    'automation': 'Automation',
    'code-scanning': 'Code Scanning'
};

type WorkflowDefinition = { title: string, description: string, group: string, providerFactory: () => Promise<GitHubWorkflowProvider | undefined> };

async function selectWorkflowProvider(type: string | undefined): Promise<GitHubWorkflowProvider | undefined> {
    if (type) {
        const starterDefinition = starterDefinitions.find(definition => definition.id === type);

        if (starterDefinition) {
            return createStarterWorkflowProvider(starterDefinition);
        }

        const workflowProvider = getWorkflowProvider(type);

        if (workflowProvider) {
            return workflowProvider;
        }

        throw new Error(`No template '${type}' is registered.`);
    } else {
        const starterWorkflowDefinitions: WorkflowDefinition[] = starterDefinitions.map(definition => ({ title: definition.properties.name, description: definition.properties.description, group: definition.group, providerFactory: () => Promise.resolve(createStarterWorkflowProvider(definition)) }));        
        const extensionWorkflowDefinitions: WorkflowDefinition[] = getCustomWorkflows().map(contribution => ({ title: contribution.title, description: contribution.description, group: contribution.group, providerFactory: () => getWorkflowProvider(contribution.workflow) }));
        const allWorkflowDefinitions = starterWorkflowDefinitions.concat(extensionWorkflowDefinitions);

        // TODO: Have well known groups (to protect against changes to ID or label over time)?
        const groupedTemplates = allWorkflowDefinitions.reduce<{ [key: string]: { label: string, templates: WorkflowDefinition[] } }>(
            (previous, current) => {
                const label = groupLabels[current.group] || current.group;
                const group = previous[label] || { label, templates: [] };

                group.templates.push(current);

                previous[label] = group;

                return previous;
            },
            {});

        const items: (vscode.QuickPickItem & { template?: WorkflowDefinition })[] =
            Object
                .values(groupedTemplates)
                .sort((a, b) => a.label.localeCompare(b.label))
                .map(group => {
                    var separator: vscode.QuickPickItem = { label: group.label, kind: vscode.QuickPickItemKind.Separator };

                    return [separator].concat(
                        group
                            .templates
                            .sort((a, b) => a.title.localeCompare(b.title))
                            .map(template => ({ label: template.title, detail: template.description, template })));
                })
                .flatMap(groupItems => groupItems);

       
        const selectedItem = await vscode.window.showQuickPick(items);

        return await selectedItem?.template?.providerFactory();
    }
}

export async function createWorkflow(context?: GitHubRepoContext, type?: string, callerContext?: never): Promise<void> {
    await ensureStarterWorkflowsRegistered();

    const provider = await selectWorkflowProvider(type);

    if (!provider) {
      throw new Error(`No workflow provider for '${type}' was registered.`);
    }

    let gitHubRepoContext = context;

    const workspaceUri = gitHubRepoContext?.workspaceUri ?? await selectWorkspace();

    if (!workspaceUri) {
      return;
    }

    if (!gitHubRepoContext) {
      gitHubRepoContext = await getGitHubContextForWorkspaceUri(workspaceUri);
    }

    await provider.createWorkflow({
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
