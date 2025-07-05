import type { Result } from "ts-explicit-errors"
import { attempt, err, isErr } from "ts-explicit-errors"

interface Repository {
  full_name: string
  html_url: string
}

const TITLE_HEADER = "# Stars"
const UNSORTED_HEADER = "## Unsorted"
const MD_FILE_NAME = "stars.md"

async function getStarredRepos(username: string, token: string): Promise<Result<Repository[]>> {
  const allRepos: Repository[] = []
  let page = 1

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    console.info(`Fetching page ${page.toString()}...`)

    // biome-ignore lint/nursery/noAwaitInLoop: ignore
    const res = await attempt(() =>
      fetch(`https://api.github.com/users/${username}/starred?per_page=100&page=${page.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
      }),
    )
    if (isErr(res)) return err("failed to fetch starts", res)
    if (!res.ok) return err(`failed to fetch stars: (${res.status.toString()}) ${res.statusText}`)

    const repos = await attempt(() => res.json() as Promise<Repository[]>)
    if (isErr(repos)) return err("failed to parse stars", repos)

    if (repos.length === 0) break

    allRepos.push(...repos)
    page++
  }

  return allRepos
}

async function generateStarsMd(currentStarsMd: string, repos: Repository[]): Promise<Result> {
  let newStarsMd = currentStarsMd
  let unsortedHeaderIndex = newStarsMd.indexOf(UNSORTED_HEADER)
  if (unsortedHeaderIndex === -1) {
    newStarsMd += `\n${UNSORTED_HEADER}\n`
    unsortedHeaderIndex = newStarsMd.indexOf(UNSORTED_HEADER)
  }

  const repoLinks: string[] = []
  for (const repo of repos) {
    if (currentStarsMd.includes(repo.html_url)) continue
    repoLinks.push(`- [${repo.full_name}](${repo.html_url})`)
  }
  console.info(`Found ${repoLinks.length.toString()} new starred repositories`)
  if (repoLinks.length === 0) return

  const repoLinksStr = `\n${repoLinks.join("\n")}\n`

  const insertPosition = newStarsMd.indexOf("\n", unsortedHeaderIndex) + 1
  const beforeInsert = newStarsMd.slice(0, insertPosition)
  const afterInsert = newStarsMd.slice(insertPosition)
  newStarsMd = `${beforeInsert}${repoLinksStr}${afterInsert}`

  const writeResult = await attempt(() => Bun.write(MD_FILE_NAME, newStarsMd))
  if (isErr(writeResult)) return err(`failed to write ${MD_FILE_NAME}`, writeResult)
}

async function main(): Promise<Result> {
  const { GITHUB_USERNAME, GITHUB_TOKEN } = Bun.env
  if (!GITHUB_USERNAME) return err("GITHUB_USERNAME is not set")
  if (!GITHUB_TOKEN) return err("GITHUB_TOKEN is not set")

  const repos = await getStarredRepos(GITHUB_USERNAME, GITHUB_TOKEN)
  if (isErr(repos)) return err("failed to get starred repos", repos)

  console.info(`Fetched ${repos.length.toString()} starred repositories`)

  const currentStarsMd = await attempt(async () => {
    const file = Bun.file(MD_FILE_NAME)
    const exists = await file.exists()
    if (!exists) return `${TITLE_HEADER}\n\n---\n\n${UNSORTED_HEADER}\n`
    return file.text()
  })
  if (isErr(currentStarsMd)) return err("failed to read current stars", currentStarsMd)

  const generateStarsMdErr = await generateStarsMd(currentStarsMd, repos)
  if (isErr(generateStarsMdErr)) return err(`failed to generate ${MD_FILE_NAME}`, generateStarsMdErr)

  return
}

const result = await main()
if (isErr(result)) {
  console.error(result.fmtErr("something went wrong"))
  // biome-ignore lint/nursery/noProcessGlobal: using an import statement of 'import * as process from "node:process"' causes 'exitCode' to be readonly, so assigning to it is an error
  process.exitCode = 1
}
