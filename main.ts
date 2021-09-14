import * as O from 'fp-ts/lib/Option'
import * as E from 'fp-ts/lib/Either'
import {pipe} from 'fp-ts/lib/function'

import {Notice, Plugin, MarkdownView, TFile} from 'obsidian'
import {match, __} from 'ts-pattern'

import {processFile} from './processFile'

export default class MyPlugin extends Plugin {
  statusBarItem?: HTMLElement

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

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () =>
        this.onActiveLeafChange(),
      ),
    )
  }

  onActiveLeafChange() {
    pipe(
      this.getGrothFromCache(),
      O.match(
        () => this.clearStatus(),
        (growth) => this.setStatus(growth),
      ),
    )
  }

  getCurrentMdFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)

    return view?.file ?? null
  }

  getGrothFromCache() {
    return pipe(
      this.getCurrentMdFile(),
      O.fromNullable,
      O.mapNullable((file) => this.app.metadataCache.getFileCache(file)),
      O.mapNullable((meta) => meta.frontmatter?.growth),
    )
  }

  growFile(file: TFile) {
    this.app.vault
      .read(file)
      .then(processFile)
      .then(
        E.match(
          (error) => Promise.reject(error),
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

                this.setStatus(grewInto)
              })
              .catch(() => Promise.reject('Failed to save active file')),
        ),
      )
      .catch((error) => {
        if (typeof error === 'string') {
          new Notice(error)
        } else {
          new Notice('Failed to read active file')
        }
      })
  }

  setStatus(growth: unknown) {
    match(growth)
      .with('Seedling', () => this.getStatusBarItem().setText('🌱'))
      .with('Budding', () => this.getStatusBarItem().setText('🌿'))
      .with('Evergreen', () => this.getStatusBarItem().setText('🌳'))
      .otherwise(() => this.clearStatus())
  }

  clearStatus() {
    // TODO: how to actually clear it?
    this.getStatusBarItem().setText('')
  }

  getStatusBarItem() {
    if (!this.statusBarItem) {
      this.statusBarItem = this.addStatusBarItem()
    }
    return this.statusBarItem
  }
}
