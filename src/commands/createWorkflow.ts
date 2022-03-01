import * as vscode from "vscode";

import { GitHubRepoContext } from "../git/repository";
import { getWorkflowUri } from "../workflow/workflow";

interface CreateWorkflowCommandArgs {
  gitHubRepoContext: GitHubRepoContext;
}

export function registerCreateWorkflow(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.workflow.create",
      async (args?: CreateWorkflowCommandArgs) => {
        const { gitHubRepoContext } = args ?? {};

        const name = await vscode.window.showInputBox(
            {
                prompt: "Enter a name for the new workflow",
                placeHolder: "ci"
            });
      }
    )
  );
}
