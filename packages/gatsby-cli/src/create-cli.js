const path = require(`path`)
const resolveCwd = require(`resolve-cwd`)
const yargs = require(`yargs`)
const report = require(`./reporter`)

const DEFAULT_BROWSERS =  [
  `> 1%`,
  `last 2 versions`,
  `IE >= 9`,
]

const handler = (fn) => (...args) => {
  Promise.resolve(fn(...args))
    .then(() => process.exit(0), (err) => report.panic(err))
}

function buildLocalCommands(cli, isLocalSite) {
  const defaultHost = `localhost`
  const directory = path.resolve(`.`)

  function getSiteInfo() {
    if (!isLocalSite) return {}

    const sitePackageJson = require(path.join(directory, `package.json`))
    const browserslist = sitePackageJson.browserslist || DEFAULT_BROWSERS
    return { sitePackageJson, browserslist }
  }

  function resolveLocalCommand(command) {
    if (!isLocalSite) {
      cli.showHelp()
      report.verbose(`current directory: ${directory}`)
      return report.panic(
        `gatsby <${command}> can only be run for a gatsby site. \n` +
        `Either the current working directory does not contain a package.json or ` +
        `'gatsby' is not specified as a dependency`
      )
    }

    try {
      const cmdPath = (
        resolveCwd.silent(`gatsby/dist/commands/${command}`) ||
        // Old location of commands
        resolveCwd.silent(`gatsby/dist/utils/${command}`)
      )
      if (!cmdPath)
        return report.panic(`There was a problem loading the local ${command} command. Gatsby may not be installed.`)

      report.verbose(`loading local command from: ${cmdPath}`)
      return require(cmdPath)
    } catch (err) {
      cli.showHelp()
      return report.panic(
        `There was a problem loading the local ${command} command. Gatsby may not be installed.`,
        err
      )
    }
  }

  cli.command({
    command: `develop`,
    desc:
      `Start development server. Watches files, rebuilds, and hot reloads ` +
      `if something changes`,
    builder: _ => _
      .option(`H`, {
        alias: `host`,
        type: `string`,
        default: defaultHost,
        describe: `Set host. Defaults to ${defaultHost}`,
      })
      .option(`p`, {
        alias: `port`,
        type: `string`,
        default: `8000`,
        describe: `Set port. Defaults to 8000`,
      })
      .option(`o`, {
        alias: `open`,
        type: `boolean`,
        describe: `Open the site in your browser for you.`,
      }),
    handler: handler(argv => {
      const { sitePackageJson, browserslist } = getSiteInfo()
      return resolveLocalCommand(`develop`)({
        ...argv,
        directory,
        sitePackageJson,
        browserslist,
      })
    }),
  })

  cli
    .command({
      command: `build`,
      desc: `Build a Gatsby project.`,
      builder: _ => _
        .option(`prefix-paths`, {
          type: `boolean`,
          default: false,
          describe: `Build site with link paths prefixed (set prefix in your config).`,
        }),
      handler: handler(argv => {
        process.env.NODE_ENV = `production`
        const { sitePackageJson, browserslist } = getSiteInfo()

        return resolveLocalCommand(`build`)({
          ...argv,
          directory,
          sitePackageJson,
          browserslist,
        })
      }),
    })

    cli
      .command({
        command: `serve`,
        desc: `Serve previously built Gatsby site.`,
        builder: _ => _
          .option(`H`, {
            alias: `host`,
            type: `string`,
            default: defaultHost,
            describe: `Set host. Defaults to ${defaultHost}`,
          })
          .option(`p`, {
            alias: `port`,
            type: `string`,
            default: `8000`,
            describe: `Set port. Defaults to 8000`,
          })
          .option(`o`, {
            alias: `open`,
            type: `boolean`,
            describe: `Open the site in your browser for you.`,
          }),

        handler: handler(argv => {
          const { sitePackageJson, browserslist } = getSiteInfo()
          return resolveLocalCommand(`serve`)({
            ...argv,
            directory,
            sitePackageJson,
            browserslist,
          })
        }),
      })
}

function isLocalGatsbySite() {
  let inGatsbySite = false
  try {
    let { dependencies, devDependencies } = require(path.resolve(`./package.json`))
    inGatsbySite = (
      (dependencies && dependencies.gatsby) ||
      (devDependencies && devDependencies.gatsby)
    )
  } catch (err) { /* ignore */ }
  return inGatsbySite
}

module.exports = (argv, handlers) => {
  let cli = yargs()
  let isLocalSite = isLocalGatsbySite()

  cli
    .usage(`Usage: $0 <command> [options]`)
    .help(`h`).alias(`h`, `help`)
    .version().alias(`v`, `version`)

  buildLocalCommands(cli, isLocalSite)

  return cli
    .command({
      command: `new [rootPath] [starter]`,
      desc: `Create new Gatsby project.`,
      handler: handler(({
        rootPath,
        starter = `gatsbyjs/gatsby-starter-default`,
      }) => {
        const initStarter = require(`./init-starter`)
        return initStarter(starter, { rootPath })
      }),
    })
    .wrap(cli.terminalWidth())
    .demandCommand(1, `Pass --help to see all available commands and options.`)
    .showHelpOnFail(true, `A command is required.`)
    .parse(argv.slice(2))
}