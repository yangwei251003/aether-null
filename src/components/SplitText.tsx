type SplitTextProps = {
  children: string
  className?: string
  id?: string
  as?: 'h1' | 'h2' | 'p' | 'span'
  variableTitle?: boolean
}

export function SplitText({ children, className = '', id, as: Tag = 'span', variableTitle = false }: SplitTextProps) {
  return (
    <Tag id={id} className={`split-text ${className}`} aria-label={children} data-variable-title={variableTitle || undefined}>
      {children.split(' ').map((word, wordIndex) => (
        <span className="split-word" aria-hidden="true" key={`${word}-${wordIndex}`}>
          {word.split('').map((character, charIndex) => (
            <span className="split-char" data-char key={`${character}-${charIndex}`}>{character}</span>
          ))}
          {wordIndex < children.split(' ').length - 1 ? <span className="split-space">&nbsp;</span> : null}
        </span>
      ))}
    </Tag>
  )
}
