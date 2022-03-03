import * as vscode from "vscode";

import { GitHubRepoContext } from "../git/repository";

enum WorkflowCategory {
    Automation,
    ContinuousIntegration,
    Deployment
}

interface WorkflowTemplate {
    author: string;
    category: WorkflowCategory;
    description: string;
    templateFileName: string;
    title: string;
}

const workflowTemplates: WorkflowTemplate[] = [
  {
      author: "Microsoft Azure",
      category: WorkflowCategory.Deployment,
      description: "Build a Node.js project and deploy it to an Azure Web App.",
      templateFileName: "azure-webapps-node.yml",
      title: "Deploy Node.js to Azure Web App"
  },
  {
      author: "Microsoft Azure",
      category: WorkflowCategory.Deployment,
      description: "Build a .NET Core project and deploy it to an Azure Web App.",
      templateFileName: "azure-webapps-dotnet-core.yml",
      title: "Deploy a .NET Core app to an Azure Web App"
  },
  {
      author: "Microsoft Azure",
      category: WorkflowCategory.Deployment,
      description: "Build and deploy web application to an Azure Static Web App.",
      templateFileName: "azure-staticwebapp.yml",
      title: "Deploy web app to Azure Static Web Apps"
  }
];

interface CreateWorkflowCommandArgs {
  gitHubRepoContext: GitHubRepoContext;
}

async function selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  if (vscode.workspace.workspaceFolders === undefined || vscode.workspace.workspaceFolders.length === 0) {
    throw new Error("No workspace folder is open");
  } else if (vscode.workspace.workspaceFolders.length === 1) {
    return vscode.workspace.workspaceFolders[0];
  } else {
    const selectedWorkspace = await vscode.window.showQuickPick(
      vscode.workspace.workspaceFolders.map(folder => ({ label: folder.name, folder })),
      {
        title: "Select a workspace folder to create the workflow in"
      });

    return selectedWorkspace?.folder;
  }
}

export function registerCreateWorkflow(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.workflow.create",
      async (args?: CreateWorkflowCommandArgs) => {
        const { gitHubRepoContext } = args ?? {};

        const items = workflowTemplates.map(template => ({ label: template.title, description: template.description, templateFileName: template.templateFileName }));

        const selectedItem = await vscode.window.showQuickPick(items);

        if (!selectedItem) {
          return;
        }

        // const name = await vscode.window.showInputBox(
        //     {
        //         prompt: "Enter a name for the new workflow",
        //         placeHolder: "ci"
        //     });

        const extensionUri = context.extensionUri;
        const workflowTemplateUri = vscode.Uri.joinPath(extensionUri, "resources", "workflows", selectedItem.templateFileName);

        const workspaceFolder = await selectWorkspaceFolder();

        if (!workspaceFolder) {
          return;
        }

        const githubWorkflowsUri = vscode.Uri.joinPath(workspaceFolder.uri, ".github", "workflows");
        const workflowUri = vscode.Uri.joinPath(githubWorkflowsUri, selectedItem.templateFileName);

        // TODO: Account for name collisions.

        await vscode.workspace.fs.createDirectory(githubWorkflowsUri);

        await vscode.workspace.fs.copy(workflowTemplateUri, workflowUri);
      }));
}
