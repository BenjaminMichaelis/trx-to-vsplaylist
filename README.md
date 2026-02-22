# TRX to Playlist Converter Action

A GitHub Action that converts [TRX (Visual Studio Test Results)](https://learn.microsoft.com/dotnet/core/testing/microsoft-testing-platform-extensions-test-reports?WT.mc_id=8B97120A00B57354) files to Visual Studio Test playlist files. This action uses the [`trx-to-vsplaylist`](https://www.nuget.org/packages/trx-to-vsplaylist) .NET global tool to perform the conversion and automatically uploads the generated playlist file as an artifact that can be easily downloaded from your GitHub Actions run.

## Usage (JavaScript action with pre-install)

### Basic Usage

Convert a single TRX file to a playlist using the JavaScript action, which
automatically installs the `trx-to-vsplaylist` tool in a pre step:

```yaml
- name: Convert TRX to Playlist
  uses: BenjaminMichaelis/trx-to-vsplaylist@v2
  with:
    trx-file-path: './TestResults/results.trx'
```

### Merge Multiple TRX Files (Default Behavior)

Merge multiple TRX files into a single playlist (great for multi-framework
projects):

```yaml
- name: Convert TRX to Playlist
  uses: BenjaminMichaelis/trx-to-vsplaylist@v2
  with:
    trx-file-path: './TestResults/*.trx'  # Glob pattern for all TRX files
    test-outcomes: 'Failed'
```

### Create Separate Playlists

Create individual playlists for each TRX file:

```yaml
- name: Convert TRX to Playlist
  uses: BenjaminMichaelis/trx-to-vsplaylist@v2
  with:
    trx-file-path: './TestResults/*.trx'
    output-directory: './playlists'
    separate: true  # Creates one playlist per TRX file
    test-outcomes: 'Failed,NotExecuted'
```

### Complete Workflow Example

Example for a multi-framework project that generates separate TRX files:

```yaml
name: Test and Generate Playlists

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup .NET
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: '10.x'
    
    - name: Run Tests
      run: |
        dotnet test --logger trx --results-directory ./TestResults
    
    # Merge all TRX files into a single playlist of failed tests
    - name: Create Merged Failure Playlist
      if: always() # Run even if tests fail
      uses: BenjaminMichaelis/trx-to-vsplaylist@v2
      with:
        trx-file-path: './TestResults/*.trx'
        test-outcomes: 'Failed'
        artifact-name: 'merged-failures'
    
    # Create separate playlists for each TRX file
    - name: Create Individual Playlists  
      if: always()
      uses: BenjaminMichaelis/trx-to-vsplaylist@v2
      with:
        trx-file-path: './TestResults/*.trx'
        output-directory: './individual-playlists'
        separate: true
        test-outcomes: 'NotExecuted'
        artifact-name: 'individual-playlists'
    
    # Both merged and individual playlists will be uploaded as separate artifacts
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `trx-file-path` | Path or glob pattern to the TRX file(s) to convert. Supports wildcards like `*.trx` or `**/TestResults/*.trx`. Multiple files will be merged by default. | Yes | - |
| `output-directory` | Directory to write the output playlist file(s) to. If not specified, saves in the same directory as the first TRX file. | No | - |
| `test-outcomes` | Test outcomes to include in the playlist (comma-separated). Accepts: Passed, Failed, NotExecuted, Inconclusive, Timeout, Pending | No | `Failed` |
| `artifact-name` | Name for the uploaded artifact. If not specified, defaults to appropriate name based on mode. | No | `test-playlists` |
| `skip-empty` | Skip writing out empty playlist files. If true, empty playlists will not be created. | No | `true` |
| `separate` | When multiple TRX files are found, create separate playlist files for each instead of merging into one. Output directory must be specified when this is true. | No | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `playlist-path` | Path to the generated playlist file (when using merge mode with single output) |
| `playlist-paths` | Colon-separated list of paths to generated playlist files (when using separate mode) |
| `artifact-dir` | Directory containing the generated playlist file(s) |

## Test Outcomes

The following test outcomes can be specified in the `test-outcomes` input:

- Passed
- Failed
- NotExecuted
- Inconclusive
- Timeout
- Pending

You can specify multiple outcomes by separating them with commas: `Failed,NotExecuted,Timeout`

## Artifact Download

The generated playlist file is automatically uploaded as a workload artifact.

## Composite variant (legacy behavior)

If you need the original composite implementation (for example, to rely on its
exact output and artifact behavior), you can reference it explicitly via the
`composite` subdirectory:

```yaml
- name: Convert TRX to Playlist (composite)
  uses: BenjaminMichaelis/trx-to-vsplaylist/composite@v2
  with:
    trx-file-path: './TestResults/results.trx'
```

## Building the JavaScript action

Before publishing a new version, build the JavaScript action so that the
bundled files in `js/dist` are up to date:

```bash
cd js
npm install
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.
