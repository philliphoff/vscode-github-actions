import { GitHubActionsApiManager } from "./api";
import { CurrentGitHubActionsApi } from "./currentGitHubActionsApi";

export class CurrentGitHubActionsApiManager implements GitHubActionsApiManager {
    readonly currentApi: CurrentGitHubActionsApi = new CurrentGitHubActionsApi();

    getApi<T>(version: 1): T | undefined {
        switch (version) {
            case 1:
                return this.currentApi as unknown as T;
            default:
                return undefined;
        }
    }
}