import * as vscode from "vscode";
import { GitHubRepoContext } from "../../git/repository";
import { RepoSecret } from "../../model";
import { setSecret } from "../../secrets";

interface UpdateSecretCommandArgs {
  gitHubRepoContext: GitHubRepoContext;
  secret: RepoSecret;
}

export function registerUpdateSecret(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.settings.secret.update",
      async (args: UpdateSecretCommandArgs) => {
        const gitHubContext = args.gitHubRepoContext;
        const secret: RepoSecret = args.secret;

        const value = await vscode.window.showInputBox({
          prompt: "Enter the new secret value",
        });

        if (!value) {
          return;
        }

        try {
          await setSecret(gitHubContext, secret.name, value);
        } catch (e) {
          vscode.window.showErrorMessage(e.message);
        }
      }
    )
  );
}
