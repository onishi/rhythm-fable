interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  return (
    <div className="screen title-screen">
      <div className="title-notes" aria-hidden>
        <span>🎵</span>
        <span>🎶</span>
        <span>🎵</span>
      </div>
      <h1 className="title-logo">
        リズム<span className="title-logo-accent">Fable</span>
      </h1>
      <p className="title-subtitle">キツネのドラマーと リズムであそぼう!</p>
      <div className="title-howto">
        <p>
          🎵 が 🦊 のところに きたら
          <br />
          <kbd>スペース</kbd> か タップ!
        </p>
      </div>
      <button className="start-button" onClick={onStart}>
        スタート!
      </button>
      <p className="title-hint">スペースキーでもはじめられるよ</p>
    </div>
  );
}
