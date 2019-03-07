class Node<T> {
  item: T
  prev: Node<T>|null
  next: Node<T>|null
}

export type DoublyLinkedListIterator<T> = (item: T, remove: () => void) => void
export type DoublyLinkedListMapper<T, U> = (item: T, remove: () => void) => U

export default class DoublyLinkedList<T> {
  private _length: number = 0

  private _first: Node<T>|null

  private _last: Node<T>|null

  public first(): T|null {
    return this._first ? this._first.item : null
  }

  public last(): T|null {
    return this._last ? this._last.item : null
  }

  public at(idx: number): T {
    return this._at(idx).item
  }

  public push(item: T) {
    this._length++

    if (!this._first) {
      this._first = this._last = {
        item,
        prev: null,
        next: null,
      }

      return
    }

    const newItem = {
      item,
      prev: this._last,
      next: null,
    }

    this._last!.next = newItem
    this._last = newItem
  }

  public remove(idx: number) {
    const item = this._at(idx)
    this._remove(item)
  }

  public iterate(iterator: DoublyLinkedListIterator<T>) {
    if (this._length === 0) {
      return
    }

    let node: Node<T>|null = this._first

    while (node !== null) {
      iterator(node.item, this._remove.bind(this, node!))
      node = node.next
    }
  }

  public map<U>(iterator: DoublyLinkedListMapper<T, U>): U[] {
    if (this._length === 0) {
      return []
    }

    let node: Node<T>|null = this._first
    const output: U[] = []

    while (node !== null) {
      output.push(iterator(node.item, this._remove.bind(this, node!)))
      node = node.next
    }

    return output
  }

  public length(): number {
    return this._length
  }

  private _remove(node: Node<T>) {
    const originalPrev = node.prev
    const originalNext = node.next

    if (originalPrev) {
      originalPrev.next = originalNext
    } else {
      this._first = originalNext
    }

    if (originalNext) {
      originalNext.prev = originalPrev
    } else if (originalPrev) {
      this._last = originalPrev
    } else {
      this._first = this._last = null
    }

    this._length--
  }

  private _at(idx: number): Node<T> {
    if (idx >= this._length || idx < 0) {
      throw new Error(`Index ${idx} out of bounds.`)
    }

    let node: Node<T> = this._first!
    let i = 0

    while (i < idx) {
      node = node.next!
      i++
    }

    return node
  }
}
