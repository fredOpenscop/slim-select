import { debounce } from './helpers'
import Settings from './settings'
import Store, { DataArray, Optgroup, Option, OptionOptional } from './store'

export interface Callbacks {
  open: () => void
  close: () => void
  addable?: (value: string) => Promise<OptionOptional | string> | OptionOptional | string
  setSelected: (value: string[]) => void
  addOption: (option: Option) => void
  search: (search: string) => void
  beforeChange?: (newVal: Option[], oldVal: Option[]) => boolean | void
  afterChange?: (newVal: Option[]) => void
}

export interface Main {
  main: HTMLDivElement
  values: HTMLDivElement
  deselect: {
    main: HTMLDivElement
    svg: SVGSVGElement
    path: SVGPathElement
  }
  arrow: {
    main: SVGSVGElement
    path: SVGPathElement
  }
}

export interface Content {
  main: HTMLDivElement
  search: Search
  list: HTMLDivElement
}

export interface Search {
  main: HTMLDivElement
  input: HTMLInputElement
  addable?: {
    main: HTMLDivElement
    svg: SVGSVGElement
    path: SVGPathElement
  }
}

export default class Render {
  public settings: Settings
  public store: Store
  public callbacks: Callbacks

  // Elements
  public main: Main
  public content: Content

  // Classes
  public classes = {
    // Main
    main: 'ss-main',

    // Placeholder
    placeholder: 'ss-placeholder',

    // Values
    values: 'ss-values',
    single: 'ss-single',
    value: 'ss-value',
    valueText: 'ss-value-text',
    valueDelete: 'ss-value-delete',
    valueOut: 'ss-value-out',

    // Deselect
    deselect: 'ss-deselect',
    deselectPath: 'M10,10 L90,90 M10,90 L90,10', // Not a class but whatever

    // Arrow
    arrow: 'ss-arrow',
    arrowClose: 'M10,30 L50,70 L90,30', // Not a class but whatever
    arrowOpen: 'M10,70 L50,30 L90,70', // Not a class but whatever

    // Content
    content: 'ss-content',
    openAbove: 'ss-open-above',
    openBelow: 'ss-open-below',

    // Search
    search: 'ss-search',
    searchHighlighter: 'ss-search-highlight',
    searching: 'ss-searching',
    addable: 'ss-addable',
    addablePath: 'M50,10 L50,90 M10,50 L90,50', // Not a class but whatever

    // List options
    list: 'ss-list',
    optgroup: 'ss-optgroup',
    optgroupLabel: 'ss-optgroup-label',
    optgroupSelectable: 'ss-optgroup-selectable',
    option: 'ss-option',
    optionSelected: 'ss-option-selected',
    optionDelete: 'M10,10 L90,90 M10,90 L90,10', // Not a class but whatever
    highlighted: 'ss-highlighted',

    // Misc
    error: 'ss-error',
    disabled: 'ss-disabled',
    hide: 'ss-hide',
  }

  constructor(settings: Required<Settings>, store: Store, callbacks: Callbacks) {
    this.store = store
    this.settings = settings
    this.callbacks = callbacks

    this.main = this.mainDiv()
    this.content = this.contentDiv()

    // Render the values
    this.renderValues()

    // Render the options
    this.renderOptions(this.store.getData())

    // Add content to the content location settings
    this.settings.contentLocation.appendChild(this.content.main)
  }

  // Remove disabled classes
  public enable(): void {
    // Remove disabled class
    this.main.main.classList.remove(this.classes.disabled)

    // Set search input to "enabled"
    this.content.search.input.disabled = false
  }

  // Set disabled classes
  public disable(): void {
    // Add disabled class
    this.main.main.classList.add(this.classes.disabled)

    // Set search input to disabled
    this.content.search.input.disabled = true
  }

  public open(): void {
    this.main.arrow.path.setAttribute('d', this.classes.arrowOpen)

    // Add class to main container
    this.main.main.classList.add(this.settings.openPosition === 'up' ? this.classes.openAbove : this.classes.openBelow)

    // move the content in to the right location
    this.moveContent()

    // Render the options
    this.renderOptions(this.store.getData())

    // Check showContent to see if they want to specifically show in a certain direction
    if (this.settings.contentPosition === 'relative') {
      this.moveContentBelow()
    } else if (this.settings.openPosition.toLowerCase() === 'up') {
      this.moveContentAbove()
    } else if (this.settings.openPosition.toLowerCase() === 'down') {
      this.moveContentBelow()
    } else {
      // Auto identify where to put it
      if (this.putContent(this.content.main, this.settings.isOpen) === 'up') {
        this.moveContentAbove()
      } else {
        this.moveContentBelow()
      }
    }

    // Move to last selected option
    const selectedOptions = this.store.getSelectedOptions()
    if (selectedOptions.length) {
      const selectedId = selectedOptions[selectedOptions.length - 1].id
      const selectedOption = this.content.list.querySelector('[data-id="' + selectedId + '"]') as HTMLElement
      if (selectedOption) {
        this.ensureElementInView(this.content.list, selectedOption)
      }
    }
  }

  public close(): void {
    this.main.main.classList.remove(this.classes.openAbove)
    this.main.main.classList.remove(this.classes.openBelow)
    this.content.main.classList.remove(this.classes.openAbove)
    this.content.main.classList.remove(this.classes.openBelow)
    this.main.arrow.path.setAttribute('d', this.classes.arrowClose)
  }

  public mainDiv(): Main {
    // Create main container
    const main = document.createElement('div')

    // Set tabable to allow tabbing to the element
    main.tabIndex = 0

    // Add style and classes
    main.style.cssText = this.settings.style !== '' ? this.settings.style : ''

    // Clear out classlist
    main.className = ''

    // Loop through config class and add
    main.classList.add(this.settings.id)
    main.classList.add(this.classes.main)
    if (this.settings.class) {
      for (const c of this.settings.class) {
        if (c.trim() !== '') {
          main.classList.add(c.trim())
        }
      }
    }

    // If main gets focus, open the content
    main.onfocus = () => {
      if (this.settings.triggerFocus) {
        this.callbacks.open()
      }
    }

    // Deal with keyboard events on the main div
    // This is to allow for normal selecting
    // when you may not have a search bar
    main.onkeydown = (e: KeyboardEvent) => {
      // Convert above if else statemets to switch
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          this.callbacks.open()
          e.key === 'ArrowDown' ? this.highlight('down') : this.highlight('up')
          return false
        case 'Tab':
          this.callbacks.close()
          return true // Continue doing normal tabbing
        case 'Enter':
          const highlighted = this.content.list.querySelector('.' + this.classes.highlighted) as HTMLDivElement
          if (highlighted) {
            highlighted.click()
          }
          return false
        case 'Escape':
          this.callbacks.close()
          return false
      }
    }

    // Add onclick for main div
    main.onclick = (e: Event) => {
      // Dont do anything if disabled
      if (!this.settings.isEnabled) {
        return
      }

      this.settings.isOpen ? this.callbacks.close() : this.callbacks.open()
    }

    // Add values
    const values = document.createElement('div')
    values.classList.add(this.classes.values)
    main.appendChild(values)

    // Add deselect
    const deselect = document.createElement('div')
    deselect.classList.add(this.classes.deselect)
    if (!this.settings.allowDeselect || this.settings.isMultiple) {
      deselect.classList.add(this.classes.hide)
    }

    // Add deselect onclick event
    deselect.onclick = (e: Event) => {
      e.stopPropagation()

      // Dont do anything if disabled
      if (!this.settings.isEnabled) {
        return
      }

      // By Default we will delete
      let shouldDelete = true
      const before = this.store.getSelectedOptions()
      const after = [] as Option[]

      // Add beforeChange callback
      if (this.callbacks.beforeChange) {
        shouldDelete = this.callbacks.beforeChange(after, before) === true
      }

      if (shouldDelete) {
        this.callbacks.setSelected([''])

        // Check if we need to close the dropdown
        if (this.settings.closeOnSelect) {
          this.callbacks.close()
        }

        // Run afterChange callback
        if (this.callbacks.afterChange) {
          this.callbacks.afterChange(after)
        }
      }
    }

    // Add deselect svg
    const deselectSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    deselectSvg.setAttribute('viewBox', '0 0 100 100')
    const deselectPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    deselectPath.setAttribute('d', this.classes.deselectPath)
    deselectSvg.appendChild(deselectPath)
    deselect.appendChild(deselectSvg)
    main.appendChild(deselect)

    // Add arrow
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    arrow.classList.add(this.classes.arrow)
    arrow.setAttribute('viewBox', '0 0 100 100')
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    arrowPath.setAttribute('d', this.classes.arrowClose)
    if (this.settings.alwaysOpen) {
      arrow.classList.add(this.classes.hide)
    }
    arrow.appendChild(arrowPath)
    main.appendChild(arrow)

    return {
      main: main,
      values: values,
      deselect: {
        main: deselect,
        svg: deselectSvg,
        path: deselectPath,
      },
      arrow: {
        main: arrow,
        path: arrowPath,
      },
    }
  }

  public mainFocus(trigger: boolean): void {
    if (!trigger) {
      this.settings.triggerFocus = false
    }
    // Trigger focus but dont scroll to it
    this.main.main.focus({ preventScroll: true })
    this.settings.triggerFocus = true
  }

  public placeholder(): HTMLDivElement {
    // Figure out if there is a placeholder option
    const placeholderOption = this.store.filter((o) => o.placeholder, false) as Option[]

    // If there is a placeholder option use that
    // If placeholder has an html value, use that
    // If placeholder has a text, use that
    // If nothing is set, use the placeholder text
    let placeholderText = this.settings.placeholderText
    if (placeholderOption.length) {
      if (placeholderOption[0].html !== '') {
        placeholderText = placeholderOption[0].html
      } else if (placeholderOption[0].text !== '') {
        placeholderText = placeholderOption[0].text
      }
    }

    // Create placeholder div
    const placeholder = document.createElement('div')
    placeholder.classList.add(this.classes.placeholder)
    placeholder.innerHTML = placeholderText
    return placeholder
  }

  // Get selected values and append to multiSelected values container
  // and remove those who shouldnt exist
  public renderValues(): void {
    // If single select set placeholder or selected value
    if (!this.settings.isMultiple) {
      this.renderSingleValue()
      return
    }

    this.renderMultipleValues()
  }

  private renderSingleValue(): void {
    const selected = this.store.filter((o: Option): boolean => {
      return o.selected && !o.placeholder
    }, false) as Option[]
    const selectedSingle = selected.length > 0 ? selected[0] : null

    // If nothing is seleected use settings placeholder text
    if (!selectedSingle) {
      this.main.values.innerHTML = this.placeholder().outerHTML
    } else {
      // Create single value container
      const singleValue = document.createElement('div')
      singleValue.classList.add(this.classes.single)
      singleValue.innerHTML = selectedSingle.html ? selectedSingle.html : selectedSingle.text

      // If there is a selected value, set a single div
      this.main.values.innerHTML = singleValue.outerHTML
    }

    // If allowDeselect is false or selected value is empty just hide deslect
    if (!this.settings.allowDeselect || !selected.length) {
      this.main.deselect.main.classList.add(this.classes.hide)
    } else {
      this.main.deselect.main.classList.remove(this.classes.hide)
    }
  }

  private renderMultipleValues(): void {
    // Get various peices of data
    let currentNodes = this.main.values.childNodes as NodeListOf<HTMLDivElement>
    let selectedOptions = this.store.filter((opt: Option) => {
      // Only grab options that are selected and display is true
      return opt.selected && opt.display
    }, false) as Option[]

    // If selectedOptions is empty set placeholder
    if (selectedOptions.length === 0) {
      this.main.values.innerHTML = this.placeholder().outerHTML
      return
    } else {
      // If there is a placeholder, remove it
      const placeholder = this.main.values.querySelector('.' + this.classes.placeholder)
      if (placeholder) {
        placeholder.remove()
      }
    }

    // Loop through currentNodes and only include ones that are not in selectedIDs
    let removeNodes: HTMLDivElement[] = []
    for (let i = 0; i < currentNodes.length; i++) {
      const node = currentNodes[i]
      const id = node.getAttribute('data-id')
      if (id) {
        // Check if id is in selectedOptions
        const found = selectedOptions.filter((opt: Option) => {
          return opt.id === id
        }, false)

        // If not found, add to removeNodes
        if (!found.length) {
          removeNodes.push(node)
        }
      }
    }

    // Loop through and remove
    for (const n of removeNodes) {
      n.classList.add(this.classes.valueOut)
      setTimeout(() => {
        this.main.values.removeChild(n)
      }, 100)
    }

    // Add values that dont currently exist
    currentNodes = this.main.values.childNodes as NodeListOf<HTMLDivElement>
    for (let d = 0; d < selectedOptions.length; d++) {
      let shouldAdd = true
      for (let i = 0; i < currentNodes.length; i++) {
        if (selectedOptions[d].id === String(currentNodes[i].dataset.id)) {
          shouldAdd = false
        }
      }

      // If shouldAdd, insertAdjacentElement it to the values container in the order of the selectedOptions
      if (shouldAdd) {
        if (currentNodes.length === 0) {
          this.main.values.appendChild(this.multipleValue(selectedOptions[d]))
        } else if (d === 0) {
          this.main.values.insertBefore(this.multipleValue(selectedOptions[d]), currentNodes[d])
        } else {
          currentNodes[d - 1].insertAdjacentElement('afterend', this.multipleValue(selectedOptions[d]))
        }
      }
    }
  }

  public multipleValue(option: Option): HTMLDivElement {
    const value = document.createElement('div')
    value.classList.add(this.classes.value)
    value.dataset.id = option.id

    const text = document.createElement('div')
    text.classList.add(this.classes.valueText)
    text.innerHTML = option.text // For multiple values always use text
    value.appendChild(text)

    // Only add deletion if the option is not mandatory
    if (!option.mandatory) {
      // Create delete div element
      const deleteDiv = document.createElement('div')
      deleteDiv.classList.add(this.classes.valueDelete)

      // Add delete onclick event
      deleteDiv.onclick = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()

        // By Default we will delete
        let shouldDelete = true
        const before = this.store.getSelectedOptions()
        const after = before.filter((o) => {
          return o.selected && o.id !== option.id
        }, true)

        // Check if minSelected is set and if after length so, return
        if (this.settings.minSelected && after.length < this.settings.minSelected) {
          return
        }

        // If there is a beforeDeselect function run it
        if (this.callbacks.beforeChange) {
          shouldDelete = this.callbacks.beforeChange(after, before) === true
        }

        if (shouldDelete) {
          // Loop through after and append values to a variable called selected
          let selectedValues: string[] = []
          for (const o of after) {
            if (o instanceof Optgroup) {
              for (const c of o.options) {
                selectedValues.push(c.value)
              }
            }

            if (o instanceof Option) {
              selectedValues.push(o.value)
            }
          }
          this.callbacks.setSelected(selectedValues)

          // Check if we need to close the dropdown
          if (this.settings.closeOnSelect) {
            this.callbacks.close()
          }

          // Run afterChange callback
          if (this.callbacks.afterChange) {
            this.callbacks.afterChange(after)
          }
        }
      }

      // Add delete svg
      const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      deleteSvg.setAttribute('viewBox', '0 0 100 100')
      const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      deletePath.setAttribute('d', this.classes.optionDelete)
      deleteSvg.appendChild(deletePath)
      deleteDiv.appendChild(deleteSvg)

      value.appendChild(deleteDiv)
    }

    return value
  }

  public contentDiv(): Content {
    const main = document.createElement('div')
    main.classList.add(this.classes.content)

    // Add id to data-id
    main.dataset.id = this.settings.id

    // Add styles
    if (this.settings.style !== '') {
      main.style.cssText = this.settings.style
    }

    // Add classes
    if (this.settings.contentPosition === 'relative') {
      main.classList.add('ss-' + this.settings.contentPosition)
    }
    if (this.settings.class.length) {
      for (const c of this.settings.class) {
        if (c.trim() !== '') {
          main.classList.add(c.trim())
        }
      }
    }

    // Add search
    const search = this.searchDiv()
    main.appendChild(search.main)

    // Add list
    const list = this.listDiv()
    main.appendChild(list)

    return {
      main: main,
      search: search,
      list: list,
    }
  }

  public moveContent(): void {
    if (this.settings.contentPosition === 'relative') {
      return
    }

    const containerRect = this.main.main.getBoundingClientRect()
    this.content.main.style.top = containerRect.top + containerRect.height + window.scrollY + 'px'
    this.content.main.style.left = containerRect.left + window.scrollX + 'px'
    this.content.main.style.width = containerRect.width + 'px'
  }

  public searchDiv(): Search {
    const main = document.createElement('div')
    const input = document.createElement('input')
    const addable = document.createElement('div')
    main.classList.add(this.classes.search)

    // Setup search return object
    const searchReturn: Search = {
      main,
      input,
    }

    // We still want the search to be tabable but not shown
    if (!this.settings.showSearch) {
      main.classList.add(this.classes.hide)
      input.readOnly = true
    }

    input.type = 'search'
    input.placeholder = this.settings.searchPlaceholder
    input.tabIndex = -1
    input.setAttribute('aria-label', this.settings.searchPlaceholder)
    input.setAttribute('autocapitalize', 'off')
    input.setAttribute('autocomplete', 'off')
    input.setAttribute('autocorrect', 'off')

    input.oninput = debounce((e: Event) => {
      this.callbacks.search((e.target as HTMLInputElement).value)
    }, 100)

    // Deal with keyboard events on search input field
    input.onkeydown = (e: KeyboardEvent) => {
      // Convert above if else statemets to switch
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          this.callbacks.open()
          e.key === 'ArrowDown' ? this.highlight('down') : this.highlight('up')
          return false
        case 'Tab':
          // When tabbing close the dropdown
          // which will also focus on main div
          // and then continuing normal tabbing
          this.callbacks.close()

          return true // Continue doing normal tabbing
        case 'Escape':
          this.callbacks.close()
          return false
        case 'Enter':
          if (this.callbacks.addable && e.ctrlKey) {
            addable.click()
          } else {
            const highlighted = this.content.list.querySelector('.' + this.classes.highlighted) as HTMLDivElement
            if (highlighted) {
              highlighted.click()
            }
          }
          return false
      }
    }

    // If focus is on the search input, open the dropdown
    input.onfocus = () => {
      // If we are already open, do nothing
      if (this.settings.isOpen) {
        return
      }

      this.callbacks.open()
    }
    main.appendChild(input)

    // If addable is enabled, add the addable div
    if (this.callbacks.addable) {
      // Add main class
      addable.classList.add(this.classes.addable)

      // Add svg icon
      const plus = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      plus.setAttribute('viewBox', '0 0 100 100')
      const plusPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      plusPath.setAttribute('d', this.classes.addablePath)
      plus.appendChild(plusPath)
      addable.appendChild(plus)

      // Add click event to addable div
      addable.onclick = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()

        // Do nothing if addable is not set
        if (!this.callbacks.addable) {
          return
        }

        // Grab input value
        const inputValue = this.content.search.input.value.trim()
        if (inputValue === '') {
          this.content.search.input.focus()
          return
        }

        // Run finish will be ran at the end of the addable function.
        // Reason its in a function is so we can run it after the
        // addable function is done for promise based addables
        const runFinish = (oo: OptionOptional) => {
          let newOption = new Option(oo)

          // Call addOption to add the new option
          this.callbacks.addOption(newOption)

          // set selected value for single and multiple
          if (this.settings.isMultiple) {
            let values = this.store.getSelected()
            values.push(newOption.value)
            this.callbacks.setSelected(values)
          } else {
            this.callbacks.setSelected([newOption.value])
          }

          // Clear search
          this.callbacks.search('')

          // Close it only if closeOnSelect = true
          if (this.settings.closeOnSelect) {
            setTimeout(() => {
              // Give it a little padding for a better looking animation
              this.callbacks.close()
            }, 100)
          }
        }

        // Call addable callback
        const addableValue = this.callbacks.addable(inputValue)

        // If addableValue is a promise, wait for it to resolve
        if (addableValue instanceof Promise) {
          addableValue.then((value) => {
            if (typeof value === 'string') {
              runFinish({
                text: value,
                value: value,
              })
            } else {
              runFinish(value)
            }
          })
        } else if (typeof addableValue === 'string') {
          runFinish({
            text: addableValue,
            value: addableValue,
          })
        } else {
          runFinish(addableValue)
        }

        return
      }
      main.appendChild(addable)

      // Add the addable to the search return
      searchReturn.addable = {
        main: addable,
        svg: plus,
        path: plusPath,
      }
    }

    return searchReturn
  }

  public searchFocus(trigger: boolean): void {
    if (!trigger) {
      this.settings.triggerFocus = false
    }
    this.content.search.input.focus()
    this.settings.triggerFocus = true
  }

  public getOptions(notPlaceholder = false, notDisabled = false, notHidden = false): HTMLDivElement[] {
    // Put together query string
    let query = '.' + this.classes.option
    if (notPlaceholder) {
      query += ':not(.' + this.classes.placeholder + ')'
    }
    if (notDisabled) {
      query += ':not(.' + this.classes.disabled + ')'
    }
    if (notHidden) {
      query += ':not(.' + this.classes.hide + ')'
    }

    return Array.from(this.content.list.querySelectorAll(query))
  }

  // highlightUp is used to highlight the previous option in the list
  public highlight(dir: 'up' | 'down'): void {
    // Get full list of options in list
    const options = this.getOptions(true, true, true)

    // If there are no options, do nothing
    if (options.length === 0) {
      return
    }

    // If length is 1, highlight it
    if (options.length === 1) {
      // Check if option doesnt already has highlighted class
      if (!options[0].classList.contains(this.classes.highlighted)) {
        options[0].classList.add(this.classes.highlighted)
        return
      }
    }

    // Loop through options and find the highlighted one
    for (let i = 0; i < options.length; i++) {
      if (options[i].classList.contains(this.classes.highlighted)) {
        // Remove highlighted class from current one
        options[i].classList.remove(this.classes.highlighted)

        // Highlight the next one
        if (dir === 'down') {
          if (i + 1 < options.length) {
            options[i + 1].classList.add(this.classes.highlighted)
            this.ensureElementInView(this.content.list, options[i + 1])
          } else {
            options[0].classList.add(this.classes.highlighted)
            this.ensureElementInView(this.content.list, options[0])
          }
        } else {
          if (i - 1 >= 0) {
            options[i - 1].classList.add(this.classes.highlighted)
            this.ensureElementInView(this.content.list, options[i - 1])
          } else {
            options[options.length - 1].classList.add(this.classes.highlighted)
            this.ensureElementInView(this.content.list, options[options.length - 1])
          }
        }

        return
      }
    }

    // If we get here, there is no highlighted option
    // So we will highlight the first or last based upon direction
    options[dir === 'down' ? 0 : options.length - 1].classList.add(this.classes.highlighted)

    // Scroll to highlighted one
    this.ensureElementInView(this.content.list, options[dir === 'down' ? 0 : options.length - 1])
  }

  // Create main container that options will reside
  public listDiv(): HTMLDivElement {
    const options = document.createElement('div')
    options.classList.add(this.classes.list)
    options.setAttribute('role', 'listbox')

    return options
  }

  public renderError(error: string) {
    // Clear out innerHtml
    this.content.list.innerHTML = ''

    const errorDiv = document.createElement('div')
    errorDiv.classList.add(this.classes.error)
    errorDiv.textContent = error
    this.content.list.appendChild(errorDiv)
  }

  public renderSearching() {
    // Clear out innerHtml
    this.content.list.innerHTML = ''

    const searchingDiv = document.createElement('div')
    searchingDiv.classList.add(this.classes.searching)
    searchingDiv.textContent = this.settings.searchingText
    this.content.list.appendChild(searchingDiv)
  }

  // Take in data and add options to
  public renderOptions(data: DataArray): void {
    // Clear out innerHtml
    this.content.list.innerHTML = ''

    // If no results show no results text
    if (data.length === 0) {
      const noResults = document.createElement('div')
      noResults.classList.add(this.classes.option)
      noResults.classList.add(this.classes.disabled)
      noResults.innerHTML = this.settings.searchText
      this.content.list.appendChild(noResults)
      return
    }

    // Append individual options to div container
    for (const d of data) {
      // Create optgroup
      if (d instanceof Optgroup) {
        // Create optgroup
        const optgroupEl = document.createElement('div')
        optgroupEl.classList.add(this.classes.optgroup)

        // Create label
        const optgroupLabel = document.createElement('div')
        optgroupLabel.classList.add(this.classes.optgroupLabel)
        optgroupLabel.innerHTML = d.label

        // If selectByGroup is true and isMultiple then add click event to label
        if (this.settings.selectByGroup && this.settings.isMultiple) {
          optgroupLabel.classList.add(this.classes.optgroupSelectable)
          optgroupLabel.addEventListener('click', (e: MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()

            for (const childEl of optgroupEl.children as any as HTMLDivElement[]) {
              if (childEl.className.indexOf(this.classes.option) !== -1) {
                childEl.click()
              }
            }
          })
        }

        // Add optgroup label
        optgroupEl.appendChild(optgroupLabel)

        // Loop through options
        for (const o of d.options) {
          optgroupEl.appendChild(this.option(o))
        }

        // Add optgroup to list
        this.content.list.appendChild(optgroupEl)
      }

      // Create option
      if (d instanceof Option) {
        this.content.list.appendChild(this.option(d as Option))
      }
    }
  }

  // Create option div element
  public option(option: Option): HTMLDivElement {
    // Add hidden placeholder
    if (option.placeholder) {
      const placeholder = document.createElement('div')
      placeholder.classList.add(this.classes.option)
      placeholder.classList.add(this.classes.hide)
      return placeholder
    }

    // Create option
    const optionEl = document.createElement('div')
    optionEl.dataset.id = option.id // Dataset id for identifying an option
    optionEl.classList.add(this.classes.option)
    optionEl.setAttribute('role', 'option') // WCAG attribute
    if (option.class) {
      option.class.split(' ').forEach((dataClass: string) => {
        optionEl.classList.add(dataClass)
      })
    }
    if (option.style) {
      optionEl.style.cssText = option.style
    }

    // Set option content
    if (this.settings.searchHighlight && this.content.search.input.value.trim() !== '') {
      const textOrHtml = option.html !== '' ? option.html : option.text
      optionEl.innerHTML = this.highlightText(
        textOrHtml,
        this.content.search.input.value,
        this.classes.searchHighlighter,
      )
    } else if (option.html !== '') {
      optionEl.innerHTML = option.html
    } else {
      optionEl.textContent = option.text
    }

    // Set title attribute
    if (this.settings.showOptionTooltips && optionEl.textContent) {
      optionEl.setAttribute('title', optionEl.textContent)
    }

    // If allowed to deselect, null onclick and add disabled
    if ((option.selected && !this.settings.allowDeselect) || (option.disabled && !this.settings.allowDeselect)) {
      optionEl.classList.add(this.classes.disabled)
    }

    // If option is selected and hideSelectedOption is true, hide it
    if (option.selected && this.settings.hideSelected) {
      optionEl.classList.add(this.classes.hide)
    }

    // If option is selected
    if (option.selected) {
      optionEl.classList.add(this.classes.optionSelected)
    } else {
      optionEl.classList.remove(this.classes.optionSelected)
    }

    // Add click event listener
    optionEl.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Setup variables
      const selectedOptions = this.store.getSelected()
      const element = e.currentTarget as HTMLDivElement
      const elementID = String(element.dataset.id)

      // If the option is disabled or selected and the user isnt allowed to deselect
      if (option.disabled || (option.selected && !this.settings.allowDeselect)) {
        return
      }

      // Check limit and do nothing if limit is reached
      if (
        this.settings.isMultiple &&
        Array.isArray(selectedOptions) &&
        this.settings.maxSelected <= selectedOptions.length
      ) {
        return
      }

      // Setup variables
      let shouldUpdate = false
      const before = this.store.getSelectedOptions()
      let after = [] as Option[]

      // If multiple
      if (this.settings.isMultiple) {
        if (option.selected) {
          // If selected after would remove
          after = before.filter((o: Option) => o.id !== elementID)
        } else {
          // If not selected after would add
          after = before.concat(option)
        }
      }

      // If single
      if (!this.settings.isMultiple) {
        if (option.selected) {
          // If selected after would remove
          after = []
        } else {
          // If not selected after would add
          after = [option]
        }
      }

      // If no beforeOnChange is set automatically update at end
      if (!this.callbacks.beforeChange) {
        shouldUpdate = true
      }

      if (this.callbacks.beforeChange) {
        // Check if beforeChange returns false
        if (this.callbacks.beforeChange(after, before) === false) {
          shouldUpdate = false
        } else {
          shouldUpdate = true
        }
      }

      if (shouldUpdate) {
        // Check if the option exists in the store
        // if not run addOption callback
        if (!this.store.getOptionByID(elementID)) {
          this.callbacks.addOption(option)
        }

        // Get values from after and set as selected
        this.callbacks.setSelected(after.map((o: Option) => o.value))

        // If closeOnSelect is true
        if (this.settings.closeOnSelect) {
          this.callbacks.close()
        }

        // callback that the value has changed
        if (this.callbacks.afterChange) {
          this.callbacks.afterChange(after)
        }
      }
    })

    return optionEl
  }

  public destroy(): void {
    // Remove main
    this.main.main.remove()

    // Remove content
    this.content.main.remove()
  }

  private highlightText(str: string, search: any, className: string) {
    // the completed string will be itself if already set, otherwise, the string that was passed in
    let completedString: any = str
    const regex = new RegExp('(' + search.trim() + ')(?![^<]*>[^<>]*</)', 'i')

    // If the regex doesn't match the string just exit
    if (!str.match(regex)) {
      return str
    }

    // Otherwise, get to highlighting
    const matchStartPosition = (str.match(regex) as any).index
    const matchEndPosition = matchStartPosition + (str.match(regex) as any)[0].toString().length
    const originalTextFoundByRegex = str.substring(matchStartPosition, matchEndPosition)
    completedString = completedString.replace(regex, `<mark class="${className}">${originalTextFoundByRegex}</mark>`)
    return completedString
  }

  public moveContentAbove(): void {
    let mainHeight: number = this.main.main.offsetHeight

    const contentHeight = this.content.main.offsetHeight
    const height = mainHeight + contentHeight - 1
    this.content.main.style.margin = '-' + height + 'px 0px 0px 0px'
    this.content.main.style.transformOrigin = 'center bottom'

    this.main.main.classList.remove(this.classes.openBelow)
    this.main.main.classList.add(this.classes.openAbove)
    this.content.main.classList.remove(this.classes.openBelow)
    this.content.main.classList.add(this.classes.openAbove)
  }

  public moveContentBelow(): void {
    this.content.main.style.margin = '-1px 0px 0px 0px'
    this.content.main.style.transformOrigin = 'center top'

    this.main.main.classList.remove(this.classes.openAbove)
    this.main.main.classList.add(this.classes.openBelow)
    this.content.main.classList.remove(this.classes.openAbove)
    this.content.main.classList.add(this.classes.openBelow)
  }

  public ensureElementInView(container: HTMLElement, element: HTMLElement): void {
    // Determine container top and bottom
    const cTop = container.scrollTop + container.offsetTop // Make sure to have offsetTop
    const cBottom = cTop + container.clientHeight

    // Determine element top and bottom
    const eTop = element.offsetTop
    const eBottom = eTop + element.clientHeight

    // Check if out of view
    if (eTop < cTop) {
      container.scrollTop -= cTop - eTop
    } else if (eBottom > cBottom) {
      container.scrollTop += eBottom - cBottom
    }
  }

  public putContent(el: HTMLElement, isOpen: boolean): 'up' | 'down' {
    const height = el.offsetHeight
    const rect = el.getBoundingClientRect()
    const elemTop = isOpen ? rect.top : rect.top - height
    const elemBottom = isOpen ? rect.bottom : rect.bottom + height

    if (elemTop <= 0) {
      return 'down'
    }
    if (elemBottom >= window.innerHeight) {
      return 'up'
    }

    // default to current position if we cant determine a perfect one
    return 'down'
  }
}