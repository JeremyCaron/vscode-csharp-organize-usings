import * as fs from 'fs';
import * as path from 'path';

export const findFiles = (dir: string, mask: RegExp): string[] =>
{
    const results: string[] = [];
    for (const file of fs.readdirSync(dir))
    {
        const stats = fs.lstatSync(path.join(dir, file));
        if (stats.isDirectory())
        {
            results.push(...findFiles(path.join(dir, file), mask));
        }
        else
        {
            if (mask.test(file))
            {
                results.push(path.join(dir, file));
            }
        }
    }
    return results;
};

/**
 * Checks if the project is a Unity project by looking for Unity-specific folders.
 * @param {string} projectDir - The directory containing the .csproj file.
 * @returns {boolean} - True if this appears to be a Unity project.
 */
export const isUnityProject = (projectDir: string): boolean =>
{
    // Unity projects have Assets and ProjectSettings folders at the solution root
    // Need to traverse up to find the solution root (where .sln file is)
    let currentDir = projectDir;

    while (currentDir && currentDir !== path.parse(currentDir).root)
    {
        const assetsDir = path.join(currentDir, 'Assets');
        const projectSettingsDir = path.join(currentDir, 'ProjectSettings');

        if (fs.existsSync(assetsDir) && fs.existsSync(projectSettingsDir))
        {
            return true;
        }

        // Check if there's a .sln file here (likely the root)
        const files = fs.readdirSync(currentDir);
        if (files.some(file => file.endsWith('.sln')))
        {
            // We're at the solution root, if no Unity folders here, not a Unity project
            break;
        }

        currentDir = path.dirname(currentDir);
    }

    return false;
};

/**
 * Checks if a Unity project has been compiled by Unity.
 * @param {string} projectFilePath - The full path to the .csproj file.
 * @returns {boolean} - True if the Unity project has compiled assemblies.
 */
const isUnityProjectCompiled = (projectFilePath: string): boolean =>
{
    const projectDir = path.dirname(projectFilePath);
    const projectName = path.basename(projectFilePath, '.csproj');

    // Find the Unity project root (where Assets/ and Library/ are)
    let unityRoot = projectDir;
    while (unityRoot && unityRoot !== path.parse(unityRoot).root)
    {
        const libraryDir = path.join(unityRoot, 'Library');
        const assetsDir = path.join(unityRoot, 'Assets');

        if (fs.existsSync(libraryDir) && fs.existsSync(assetsDir))
        {
            // Check for compiled assemblies in Library/ScriptAssemblies
            const scriptAssembliesDir = path.join(libraryDir, 'ScriptAssemblies');
            if (fs.existsSync(scriptAssembliesDir))
            {
                const dllPath = path.join(scriptAssembliesDir, `${projectName}.dll`);
                if (fs.existsSync(dllPath))
                {
                    return true;
                }
            }

            // If we found the Library dir but no assemblies, project isn't compiled
            return false;
        }

        unityRoot = path.dirname(unityRoot);
    }

    return false;
};

/**
 * Checks if the project specified by the given .csproj file path has been restored.
 * For standard .NET projects, this checks for NuGet restore artifacts.
 * For Unity projects, this checks if Unity has compiled the project.
 * @param {string} projectFilePath - The full path to the .csproj file.
 * @returns {boolean} - True if the project is restored/compiled, false otherwise.
 */
export const isProjectRestored = (projectFilePath: string): boolean =>
{
    if (!projectFilePath || !fs.existsSync(projectFilePath))
    {
        return false; // Invalid or non-existent project file
    }

    // Get the directory containing the .csproj file
    const projectDir = path.dirname(projectFilePath);

    // Check if this is a Unity project
    if (isUnityProject(projectDir))
    {
        return isUnityProjectCompiled(projectFilePath);
    }

    // For standard .NET projects, check for NuGet restore
    // Check for the presence of *.csproj.nuget.g.props in the obj directory
    const objDir = path.join(projectDir, 'obj');
    if (fs.existsSync(objDir))
    {
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
export const getCurrentProjectFile = (currentSourceFilePath: string): string =>
{
    // Traverse up to find the nearest .csproj file
    let currentDir = path.dirname(currentSourceFilePath);
    while (currentDir && currentDir !== path.parse(currentDir).root)
    {
        const files = fs.readdirSync(currentDir);
        const csprojFile = files.find(file => file.endsWith('.csproj'));
        if (csprojFile)
        {
            return currentDir + path.sep + csprojFile;
        }
        currentDir = path.dirname(currentDir); // Move up a directory
    }
    return ''; // No .csproj file found
};
