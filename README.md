# github-stars-to-markdown

There are many tools that do this, but all of the ones I've found are too opinionated in the structure of the markdown file. I wanted to be able to structure my markdown manually.

You can run this script on existing markdown and if the GitHub repo link already exists in the file, it will be skipped. That way you can structure/format your markdown file however you want.

## Usage

1. Copy `.env.example` to `.env` and set `GITHUB_USERNAME` and `GITHUB_TOKEN`
   - Generate a token [here](https://github.com/settings/tokens/new). It only needs the `read:user` scope
2. Run the script

```sh
bun index.ts
```

A `stars.md` file will be created in the root directory.

- **Let's say you've taken this generated markdown and organized/formatted it. You can paste that markdown into `stars.md` and run the script again. Any new links will be added under an `## Unstarted` header.**
- If there is no `## Unstarted` header, it will be created at the bottom of the file.
