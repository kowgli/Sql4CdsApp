# Intro

Standalone console wrapper around the DAXIF# package that avoids issues with F# versions and allows for easier configuration using a standard JSON file.

# Usage

1. Create a configuration file. An example named `sample_config.json` can be found inside the DaxifApp folder after installing the package.
1. Run the tool to either generate the C# context or synchronize plugins:
	1. `DaxifApp.exe gen-context config_file.json`
	1. `DaxifApp.exe reg-plugins config_file.json`


Configuration values have an identical meaning as in the base DAXIF package. Paths should be relative to the DaxifApp.exe file or wherever you run the command from.



