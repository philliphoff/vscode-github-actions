import * as vscode from "vscode";
import { GitHubRepoContext } from "../../git/repository";
import { setSecret } from "../../secrets";

interface AddSecretCommandArgs {
  gitHubRepoContext: GitHubRepoContext;
}

export function registerAddSecret(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.settings.secret.add",
      async (args: AddSecretCommandArgs) => {
        const gitHubContext = args.gitHubRepoContext;

        const name = await vscode.window.showInputBox({
          prompt: "Enter name for new secret",
        });

        if (!name) {
          return;
        }

        const value = await vscode.window.showInputBox({
          prompt: "Enter the new secret value",
        });

        if (value) {
          try {
            await setSecret(gitHubContext, name, value);
          } catch (e) {
            vscode.window.showErrorMessage(e.message);
          }
        }

        vscode.commands.executeCommand("github-actions.explorer.refresh");
      }
    )
  );
}
