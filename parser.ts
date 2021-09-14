import {pipe, identity} from 'fp-ts/lib/function'
// import * as E from 'fp-ts/lib/Either'
// import {sequenceT} from 'fp-ts/lib/Apply'
import * as A from 'fp-ts/lib/Array'
import {match, __} from 'ts-pattern'

interface MdFileSections {
  frontmatter: string[]
  content: string[]
}

interface ParsingState extends MdFileSections {
  state: 'init' | 'frontmatter' | 'content'
}

const fold =
  <R>(matcher: {
    init: () => R
    frontmatter: (f: MdFileSections) => R
    content: (f: MdFileSections) => R
  }) =>
  (state: ParsingState): R =>
    state.state === 'init'
      ? matcher.init()
      : state.state === 'frontmatter'
      ? matcher.frontmatter(state)
      : matcher.content(state)

const Init = (frontmatter: string[], content: string[]): ParsingState => ({
  state: 'init',
  frontmatter,
  content,
})

const Frontmatter = (
  frontmatter: string[],
  content: string[],
): ParsingState => ({state: 'frontmatter', frontmatter, content})

const Content = (frontmatter: string[], content: string[]): ParsingState => ({
  state: 'content',
  frontmatter,
  content,
})

const parseLines = A.reduce<string, ParsingState>(Init([], []), (state, line) =>
  match(state)
    .with({state: 'init'}, () =>
      match(line.trim())
        .with('', () => {
          state.content.push(line)

          return state
        })
        // We want to keep track of the `---` in the comment,
        // in case it is not frontmatter
        .with('---', () => Frontmatter([], ['---']))
        .otherwise(() => Content([], A.append(line)(state.content))),
    )
    .with({state: 'frontmatter'}, () =>
      match<string, ParsingState>(line.trim())
        // Clear up the content when switching from frontmatter
        .with('---', () => Content(state.frontmatter, []))
        // Accumulate content as well, in case it isn't actually frontmatter
        // Eg. a file could start with `---` but not have frontmatter
        .otherwise(() => {
          state.frontmatter.push(line)
          state.content.push(line)

          return state
        }),
    )
    .with({state: 'content'}, () => {
      state.content.push(line)

      return state
    })
    .exhaustive(),
)

export const parseFile = (fileContent: string) =>
  pipe(
    fileContent.trimStart().split('\n'),
    parseLines,
    fold<MdFileSections>({
      init: () => ({frontmatter: [], content: []}),
      frontmatter: ({content}) => ({frontmatter: [], content}),
      content: ({frontmatter, content}) => ({frontmatter, content}),
    }),
  )
