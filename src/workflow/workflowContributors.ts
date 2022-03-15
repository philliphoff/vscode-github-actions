import * as vscode from 'vscode';

export interface WorkflowContribution {
    readonly id: string;
}

export interface ExtensionPackage {
    readonly contributes?: {
        readonly 'x-workflows'?: WorkflowContribution[];
    };
}

export function getWorkflowContributors(): { [key: string]: WorkflowContribution[] } {
    // TODO: Cache and watch for extension changes.
    const workflowContributors = vscode.extensions.all
        .reduce<{ [key: string]: WorkflowContribution[] }>(
            (previous, extension) => {
                const extensionPackage: ExtensionPackage = extension.packageJSON;

                const workflows = extensionPackage?.contributes?.['x-workflows'];

                if (workflows) {
                    previous[extension.id] = workflows;
                }

                return previous;
        },
        {});

    return workflowContributors;
}