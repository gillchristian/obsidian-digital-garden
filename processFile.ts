import {pipe, identity} from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as E from 'fp-ts/lib/Either'
import * as A from 'fp-ts/lib/Array'
import * as RA from 'fp-ts/lib/ReadonlyArray'
import {sequenceT} from 'fp-ts/lib/Apply'
import {match, __} from 'ts-pattern'

import {parseFile} from './parser'

type GrowthStages = 'Seedling' | 'Budding' | 'Evergreen'

export const processFile = (fileContent: string) =>
  pipe(
    fileContent,
    parseFile,
    ({frontmatter, content}) =>
      pipe(
        frontmatter,
        A.some((line) => line.startsWith('growth:')),
        (hasGrowth) =>
          hasGrowth
            ? pipe(frontmatter, processFrontmatterWithGrow, E.sequenceArray)
            : pipe(
                frontmatter,
                A.map(E.left),
                A.append(E.right('Seedling' as GrowthStages)),
                E.right,
              ),
        E.map(intoLinesAndGrowth),
        (updated) => sequenceT(E.Apply)(updated, E.right(content)),
      ),
    E.map(([frontmatter, content]) => ({
      content: ['---', ...frontmatter.lines, '---', ...content].join('\n'),
      grewInto: frontmatter.grewInto,
    })),
  )

const intoLinesAndGrowth = (
  lines: readonly E.Either<string, GrowthStages>[],
): {lines: string[]; grewInto: GrowthStages} =>
  pipe(
    lines,
    RA.toArray,
    A.map(E.match(identity, (grewInto) => `growth: ${grewInto}`)),
    (lns) => ({
      lines: lns,
      grewInto: pipe(
        lines,
        RA.toArray,
        A.rights,
        A.head,
        O.getOrElse((): GrowthStages => 'Seedling'),
      ),
    }),
  )

const grow = (str: string): E.Either<string, GrowthStages> =>
  pipe(
    str.split(':')[1],
    E.fromNullable(`Malformed frontmatter line ("${str}")`),
    E.map((value) => value.trim()),
    E.chain((value) =>
      match<string, E.Either<string, GrowthStages>>(value)
        .with('Seedling', () => E.right('Budding'))
        .with('Budding', () => E.right('Evergreen'))
        .with('Evergreen', () => E.left("🌳 Can't grow more than that!"))
        .otherwise(() => E.right('Seedling')),
    ),
  )

const processFrontmatterWithGrow = A.map(
  (line: string): E.Either<string, E.Either<string, GrowthStages>> =>
    line.startsWith('growth:')
      ? pipe(grow(line), E.map(E.right))
      : E.right(E.left(line)),
)
