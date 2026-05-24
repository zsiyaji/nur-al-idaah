import React from 'react'
import Heading from './Heading.jsx'
import Sentence from './Sentence.jsx'

export default function Block({
  block,
  settings,
  blockIndex,
  headingMeta,
  currentSection,
  onWordClick,
  isWordInBank,
}) {
  if (block.type === 'heading') {
    return (
      <Heading
        block={block}
        settings={settings}
        blockIndex={blockIndex}
        id={headingMeta?.id}
        displayAr={headingMeta?.displayAr}
      />
    )
  }
  if (block.type === 'sentence' || block.type === 'list_item') {
    return (
      <Sentence
        block={block}
        settings={settings}
        blockIndex={blockIndex}
        currentSection={currentSection}
        onWordClick={onWordClick}
        isWordInBank={isWordInBank}
      />
    )
  }
  return null
}
