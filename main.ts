import * as E from 'fp-ts/lib/Either'
import {Notice, Plugin, MarkdownView, TFile} from 'obsidian'
import {match, __} from 'ts-pattern'

import {processFile} from './processFile'

export default class MyPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'digital-garden-grown-current-note',
      name: 'Grow',
      checkCallback: (checking: boolean) => {
        const file = this.getCurrentMdFile()

        if (file === null) {
          return false
        }

        if (checking) {
          return true
        }

        this.growFile(file)
      },
    })
  }

  onunload() {
    console.log('unloading plugin')
  }

  getCurrentMdFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)

    return view?.file ?? null
  }

  growFile(file: TFile) {
    this.app.vault
      .read(file)
      .then(processFile)
      .then(
        E.match(
          (error) => {
            new Notice(error)
          },
          ({content, grewInto}) =>
            this.app.vault
              .modify(file, content)
              .then(() => {
                new Notice(
                  match(grewInto)
                    .with('Seedling', () => '🌱 A seed was planted!')
                    .with('Budding', () => '🌿 Your seed is growing!')
                    .with('Evergreen', () => '🌳 Yay! Fully grown!')
                    .exhaustive(),
                )
              })
              .catch(() => {
                new Notice('Failed to save active file')
              }),
        ),
      )
      .catch(() => {
        new Notice('Failed to read active file')
      })
  }
}
