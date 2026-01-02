import * as fs from 'fs';
import * as path from 'path';

export const findFiles = (dir: string, mask: RegExp): string[] => {
    const results: string[] = [];
    for (const file of fs.readdirSync(dir)) {
        const stats = fs.lstatSync(path.join(dir, file));
        if (stats.isDirectory()) {
            results.push(...findFiles(path.join(dir, file), mask));
        } else {
            if (mask.test(file)) {
                results.push(path.join(dir, file));
            }
        }
    }
    return results;
};

/**
 * Checks if the project specified by the given .csproj file path has been restored.
 * @param {string} projectFilePath - The full path to the .csproj file.
 * @returns {boolean} - True if the project is restored, false otherwise.
 */
export const isProjectRestored = (projectFilePath: string): boolean => {
    if (!projectFilePath || !fs.existsSync(projectFilePath)) {
        return false; // Invalid or non-existent project file
    }

    // Get the directory containing the .csproj file
    const projectDir = path.dirname(projectFilePath);

    // Check for the presence of *.csproj.nuget.g.props in the obj directory
    const objDir = path.join(projectDir, 'obj');
    if (fs.existsSync(objDir)) {
        const objFiles = fs.readdirSync(objDir);
        return objFiles.some(file => file.endsWith('.csproj.nuget.g.props'));
    }

    return false; // obj directory not found
};

/**
 * Checks if the project containing the given file has been restored.
 * @param {string} currentSourceFilePath - The path to the file being edited.
 * @returns {boolean} - True if the project is restored, false otherwise.
 */
export const getCurrentProjectFile = (currentSourceFilePath: string): string => {
    // Traverse up to find the nearest .csproj file
    let currentDir = path.dirname(currentSourceFilePath);
    while (currentDir && currentDir !== path.parse(currentDir).root) {
        const files = fs.readdirSync(currentDir);
        const csprojFile = files.find(file => file.endsWith('.csproj'));
        if (csprojFile) {
            return currentDir + path.sep + csprojFile;
        }
        currentDir = path.dirname(currentDir); // Move up a directory
    }
    return ""; // No .csproj file found
}