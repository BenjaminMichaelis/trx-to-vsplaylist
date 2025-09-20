# TRX to Playlist Converter Action

A GitHub Action that converts [TRX (Visual Studio Test Results)](https://learn.microsoft.com/dotnet/core/testing/microsoft-testing-platform-extensions-test-reports?WT.mc_id=8B97120A00B57354) files to Visual Studio Test playlist files. This action uses the [`trx-to-vsplaylist`](https://www.nuget.org/packages/trx-to-vsplaylist) .NET global tool to perform the conversion and automatically uploads the generated playlist file as an artifact that can be easily downloaded from your GitHub Actions run.

## Features

- ✅ Converts TRX files to VS Test playlist files
- ✅ Configurable output path
- ✅ Customizable test outcome filtering
- ✅ Support for multiple TRX files with glob patterns
- ✅ Combine multiple playlists with automatic de-duplication

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
    output-directory: './artifacts'
    test-outcomes: 'Failed,NotExecuted'
    skip-empty: false # disables skipping empty playlists
```

### Combining Multiple Playlists

When you have multiple TRX files (e.g., from different target frameworks), you can combine them into a single playlist with automatic de-duplication:

```yaml
- name: Convert and Combine TRX to Playlist
  uses: BenjaminMichaelis/trx-to-vsplaylist@v1
  with:
    trx-file-path: './TestResults/*.trx' # Multiple TRX files
    test-outcomes: 'Failed'
    combine-playlists: true # Combines all playlists into one
    artifact-name: 'combined-failed-tests'
```

This is particularly useful when multiple TFMs (Target Framework Monikers) generate separate TRX files with overlapping test failures.

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
    
    # The playlist file will be automatically uploaded as an artifact named either by the specified `artifact-name` or as `playlists`
```

### Multi-Framework Testing with Combined Playlist

```yaml
name: Multi-Framework Test with Combined Playlist

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        framework: [net6.0, net8.0, net9.0]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup .NET
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: '9.x'
    
    - name: Run Tests for ${{ matrix.framework }}
      run: |
        dotnet test --framework ${{ matrix.framework }} --logger trx --results-directory ./TestResults/${{ matrix.framework }}
    
    - name: Upload TRX files
      uses: actions/upload-artifact@v4
      with:
        name: trx-${{ matrix.framework }}
        path: ./TestResults/${{ matrix.framework }}/*.trx

  combine-playlists:
    runs-on: ubuntu-latest
    needs: test
    if: always() # Run even if tests fail
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Download all TRX files
      uses: actions/download-artifact@v4
      with:
        pattern: trx-*
        path: ./all-trx
        merge-multiple: true
    
    - name: Convert and Combine TRX to Playlist
      uses: BenjaminMichaelis/trx-to-vsplaylist@v1
      with:
        trx-file-path: './all-trx/**/*.trx'
        test-outcomes: 'Failed'
        combine-playlists: true
        artifact-name: 'combined-failed-tests'
    
    # The combined playlist will contain all unique failed tests across all frameworks
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `trx-file-path` | Path to the TRX file to convert (supports glob patterns for multiple files) | Yes | - |
| `output-directory` | Directory to write the output playlist file(s) to. If not specified, saves in the same directory as the TRX file with .playlist extension | No | - |
| `test-outcomes` | Test outcomes to include in the playlist (comma-separated). Accepts: Passed, Failed, NotExecuted, Inconclusive, Timeout | No | `Failed` |
| `artifact-name` | Name for the uploaded artifact. If not specified, will use the playlist file name (without extension) | No | playlist file name |
| `skip-empty` | Skip writing out empty playlist files. If true, empty playlists will not be created. | No | `true` |
| `combine-playlists` | Combine multiple playlists into a single playlist file with de-duplication. When enabled, all individual playlists are merged into one 'combined.playlist' file. | No | `false` |

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
