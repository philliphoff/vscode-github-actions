import * as vscode from "vscode";

import { GitHubRepoContext } from "../git/repository";
import { setSecret } from "../secrets";
import { createWorkflow } from "../workflow/templates";

interface CreateWorkflowCommandArgs {
  gitHubRepoContext: GitHubRepoContext;
}

export function registerCreateWorkflow(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.workflow.create",
      async (args?: CreateWorkflowCommandArgs) => {
        const workflowFiles = await createWorkflow(args?.gitHubRepoContext);

        await Promise.all(workflowFiles.map(file => vscode.window.showTextDocument(file)));
      }));
}

