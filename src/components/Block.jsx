import React from 'react'
import Heading from './Heading.jsx'
import Sentence from './Sentence.jsx'

export default function Block({ block, settings, index, headingMeta }) {
  if (block.type === 'heading') {
    return (
      <Heading
        block={block}
        settings={settings}
        id={headingMeta?.id}
        displayAr={headingMeta?.displayAr}
      />
    )
  }
  if (block.type === 'sentence' || block.type === 'list_item') {
    return <Sentence block={block} settings={settings} index={index} />
  }
  return null
}
