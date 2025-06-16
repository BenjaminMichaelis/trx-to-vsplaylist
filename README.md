# TRX to Playlist Converter Action

A GitHub Action that converts [TRX (Visual Studio Test Results)](https://learn.microsoft.com/dotnet/core/testing/microsoft-testing-platform-extensions-test-reports?WT.mc_id=8B97120A00B57354) files to Visual Studio Test playlist files. This action uses the [`trx-to-vsplaylist`](https://www.nuget.org/packages/trx-to-vsplaylist) .NET global tool to perform the conversion and automatically uploads the generated playlist file as an artifact that can be easily downloaded from your GitHub Actions run.

## Features

- ✅ Converts TRX files to VS Test playlist files
- ✅ Configurable output path
- ✅ Customizable test outcome filtering

## Usage

### Basic Usage

```yaml
- name: Convert TRX to Playlist
  uses: BenjaminMichaelis/trx-to-vsplaylist@v1
  with:
    trx-file-path: './TestResults/results.trx'
```

### Advanced Usage

```yaml
- name: Convert TRX to Playlist
  uses: BenjaminMichaelis/trx-to-vsplaylist@v1
  with:
    trx-file-path: './TestResults/results.trx'
    output-path: './artifacts/failed-tests.playlist'
    test-outcomes: 'Failed,NotExecuted'
```

### Complete Workflow Example

```yaml
name: Test and Generate Playlist

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup .NET
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: '8.x'
    
    - name: Run Tests
      run: |
        dotnet test --logger trx --results-directory ./TestResults
    
    - name: Convert TRX to Playlist
      if: always() # Run even if tests fail
      uses: BenjaminMichaelis/trx-to-vsplaylist@v1
      with:
        trx-file-path: './TestResults/*.trx'
        test-outcomes: 'Failed'
    
    # The playlist file will be automatically uploaded as an artifact
    # with an auto-generated name and can be downloaded from the Actions tab
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `trx-file-path` | Path to the TRX file to convert | Yes | - |
| `output-path` | Path to the output playlist file. If not specified, saves in the same directory as the TRX file with .playlist extension | No | - |
| `test-outcomes` | Test outcomes to include in the playlist (comma-separated). Accepts: Passed, Failed, NotExecuted, Inconclusive, Timeout | No | `Failed` |
| `artifact-name` | Name for the uploaded artifact. If not specified, will use the playlist file name (without extension) | No | playlist file name |

## Outputs

| Output | Description |
|--------|-------------|
| `playlist-path` | Path to the generated playlist file |

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.
