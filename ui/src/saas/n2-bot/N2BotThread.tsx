// PD-SAAS-FORK: N2 Bot β left-column chat — bubbles are the context; voice is only a shell.
import { useEffect, useRef } from 'react';
import type { N2ChatMessage, N2ElicitCard } from '../../../../src/saas/n2Bot/n2BotTypes';

export default function N2BotThread(props: {
  messages: N2ChatMessage[];
  elicit: N2ElicitCard | null;
  onPickOption: (id: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [props.messages, props.elicit]);

  let lastNovaIdx = -1;
  for (let i = props.messages.length - 1; i >= 0; i -= 1) {
    if (props.messages[i]?.role === 'nova') {
      lastNovaIdx = i;
      break;
    }
  }

  return (
    <div className="n2b-thread" data-testid="n2-bot-thread">
      {props.messages.map((msg, index) => (
        <article
          key={msg.id}
          className={`n2b-msg is-${msg.role}`}
          data-testid={msg.role === 'user' ? 'n2-bot-msg-user' : 'n2-bot-msg-nova'}
        >
          {msg.role === 'nova' ? <span className="n2b-msg-who">Nova</span> : null}
          <p
            className="n2b-msg-text"
            data-testid={index === lastNovaIdx ? 'n2-bot-utterance' : undefined}
          >
            {msg.text}
          </p>
        </article>
      ))}
      {props.elicit ? (
        <div className="n2b-elicit" data-testid="n2-bot-elicit">
          <p>{props.elicit.title}</p>
          {props.elicit.body ? <p>{props.elicit.body}</p> : null}
          <div className="n2b-elicit-opts">
            {props.elicit.options.map((opt) => (
              <button key={opt.id} type="button" onClick={() => props.onPickOption(opt.id)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
