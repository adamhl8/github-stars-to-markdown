import { type Err, type Result, attempt, fmtError } from "ts-error-tuple"

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

    const [res, err] = await attempt(() =>
      fetch(`https://api.github.com/users/${username}/starred?per_page=100&page=${page.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
      }),
    )
    if (err) return [undefined, fmtError("failed to fetch starts", err)]
    if (!res.ok) return [undefined, fmtError(`failed to fetch stars: (${res.status.toString()}) ${res.statusText}`)]

    const [repos, resJsonErr] = await attempt(() => res.json() as Promise<Repository[]>)
    if (resJsonErr) return [undefined, fmtError("failed to parse stars", resJsonErr)]

    if (repos.length === 0) break

    allRepos.push(...repos)
    page++
  }

  return [allRepos, undefined]
}

async function generateStarsMd(currentStarsMd: string, repos: Repository[]): Promise<Err> {
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

  const [, writeErr] = await attempt(() => Bun.write(MD_FILE_NAME, newStarsMd))
  if (writeErr) return fmtError(`failed to write ${MD_FILE_NAME}`, writeErr)
}

async function main(): Promise<Err> {
  const { GITHUB_USERNAME, GITHUB_TOKEN } = Bun.env
  if (!GITHUB_USERNAME) return fmtError("GITHUB_USERNAME is not set")
  if (!GITHUB_TOKEN) return fmtError("GITHUB_TOKEN is not set")

  const [repos, err] = await getStarredRepos(GITHUB_USERNAME, GITHUB_TOKEN)
  if (err) return fmtError("failed to get starred repos", err)

  console.info(`Fetched ${repos.length.toString()} starred repositories`)

  const [currentStarsMd, currentStarsMdErr] = await attempt(async () => {
    const file = Bun.file(MD_FILE_NAME)
    const exists = await file.exists()
    if (!exists) return `${TITLE_HEADER}\n\n---\n\n${UNSORTED_HEADER}\n`
    return file.text()
  })
  if (currentStarsMdErr) return fmtError("failed to read current stars", currentStarsMdErr)

  const generateStarsMdErr = await generateStarsMd(currentStarsMd, repos)
  if (generateStarsMdErr) return fmtError(`failed to generate ${MD_FILE_NAME}`, generateStarsMdErr)

  return undefined
}

const err = await main()
if (err) console.error(err.message)
