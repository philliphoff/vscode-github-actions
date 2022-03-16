import * as vscode from "vscode";

import { GitHubRepoContext } from "../git/repository";
import { setSecret } from "../secrets";
import { createWorkflow } from "../workflow/templates";

enum WorkflowCategory {
    Automation,
    ContinuousIntegration,
    Deployment
}

interface WorkflowCreationContext {
  gitHubRepoContext: GitHubRepoContext | undefined;
  workflowUri: vscode.Uri;
}

interface WorkflowTemplate {
    author: string;
    category: WorkflowCategory;
    description: string;
    templateFileName: string;
    title: string;

    onCreate?: (context: WorkflowCreationContext) => Promise<void>;
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
      title: "Deploy a .NET Core app to an Azure Web App",

      onCreate: onCreateAzureWebApp
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

async function onCreateAzureWebApp(context: WorkflowCreationContext): Promise<void> {
  if (!context.gitHubRepoContext) {
    // TODO: Tell user to manually set secret.
    return;
  }
  
  const publishProfileSecretName = "AZURE_WEBAPP_PUBLISH_PROFILE";

  // TODO: Accommodate existing secret.

  await setSecret(context.gitHubRepoContext, publishProfileSecretName, "MY SECRET");
}

export function registerCreateWorkflow(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.workflow.create",
      async (args?: CreateWorkflowCommandArgs) => {
        await createWorkflow(args?.gitHubRepoContext);
      }));
}

