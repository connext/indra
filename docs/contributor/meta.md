# Connext Documentation

Documentation can be found [here](https://connext.readthedocs.io/en/latest/)

## Set Up Local Docs Viewer

Install dependencies:

- `pip install sphinx`
- `pip install recommonmark`
- `pip install sphinx_markdown_tables`
- `pip install sphinx_rtd_theme`

Build HTML:
- `make singlehtml`

Serve locally:
- `npm i -g serve` (If not already installed)
- `serve _build/singlehtml`

## Editing the Docs

Edit the existing markdown documents directly, and regenerate the build folder using `make singlehtml`.

The Table of Contents is defined by `index.rst` in the root.

To deploy edits, simply commit to master and check your edits at the [live docs](https://connext.readthedocs.io/en/latest/)

## Readthedocs

These docs are made with readthedocs and sphinx, see the getting started guide [here](https://docs.readthedocs.io/en/stable/intro/getting-started-with-sphinx.html#external-resources).
