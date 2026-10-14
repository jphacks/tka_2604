import { useState } from 'react'

import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="mx-auto flex min-h-svh w-[1126px] max-w-full flex-col border-x border-(--border) text-center">
      <section
        id="center"
        className="flex grow flex-col place-content-center place-items-center gap-[25px] max-[1025px]:gap-[18px] max-[1025px]:px-[20px] max-[1025px]:pt-[32px] max-[1025px]:pb-[24px]"
      >
        <div className="relative">
          <img
            src={heroImg}
            className="relative inset-x-0 z-0 mx-auto inline-block w-[170px] align-baseline"
            width="170"
            height="179"
            alt=""
          />
          <img
            src={reactLogo}
            className="absolute inset-x-0 top-[34px] z-[1] mx-auto h-[28px] [transform:perspective(2000px)_rotateZ(300deg)_rotateX(44deg)_rotateY(39deg)_scale(1.4)]"
            alt="React logo"
          />
          <img
            src={viteLogo}
            className="absolute inset-x-0 top-[107px] z-0 mx-auto h-[26px] w-auto [transform:perspective(2000px)_rotateZ(300deg)_rotateX(40deg)_rotateY(39deg)_scale(0.8)]"
            alt="Vite logo"
          />
        </div>
        <div>
          <h1 className="my-[32px] [font-family:var(--heading)] text-[56px] font-medium tracking-[-1.68px] text-(--text-h) max-[1025px]:my-[20px] max-[1025px]:text-[36px]">
            Get started
          </h1>
          <p>
            Edit{' '}
            <code className="inline-flex rounded-[4px] bg-(--code-bg) px-[8px] py-[4px] [font-family:var(--mono)] text-[15px] leading-[1.35] text-(--text-h)">
              src/App.tsx
            </code>{' '}
            and save to test{' '}
            <code className="inline-flex rounded-[4px] bg-(--code-bg) px-[8px] py-[4px] [font-family:var(--mono)] text-[15px] leading-[1.35] text-(--text-h)">
              HMR
            </code>
          </p>
        </div>
        <button
          type="button"
          className="mb-[24px] inline-flex rounded-[5px] border-2 border-transparent bg-(--accent-bg) px-[10px] py-[5px] [font-family:var(--mono)] text-[16px] leading-[normal] text-(--accent) transition-[border-color] duration-300 hover:border-(--accent-border) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="relative w-full before:absolute before:top-[-4.5px] before:left-0 before:border-[5px] before:border-transparent before:border-l-(--border) before:content-[''] after:absolute after:top-[-4.5px] after:right-0 after:border-[5px] after:border-transparent after:border-r-(--border) after:content-['']"></div>

      <section
        id="next-steps"
        className="flex border-t border-(--border) text-left max-[1025px]:flex-col max-[1025px]:text-center"
      >
        <div
          id="docs"
          className="flex-[1_1_0] border-r border-(--border) p-[32px] max-[1025px]:border-r-0 max-[1025px]:border-b max-[1025px]:px-[20px] max-[1025px]:py-[24px]"
        >
          <svg
            className="mb-[16px] inline-block size-[22px] align-baseline"
            role="presentation"
            aria-hidden="true"
          >
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2 className="mb-[8px] [font-family:var(--heading)] text-[24px] leading-[1.18] font-medium tracking-[-0.24px] text-(--text-h) max-[1025px]:text-[20px]">
            Documentation
          </h2>
          <p>Your questions, answered</p>
          <ul className="mt-[32px] flex list-none gap-[8px] p-0 max-[1025px]:mt-[20px] max-[1025px]:flex-wrap max-[1025px]:justify-center">
            <li className="max-[1025px]:flex-[1_1_calc(50%_-_8px)]">
              <a
                href="https://vite.dev/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-[8px] rounded-[6px] bg-(--social-bg) px-[12px] py-[6px] text-[16px] text-(--text-h) no-underline transition-shadow duration-300 hover:shadow-(--shadow) max-[1025px]:w-full max-[1025px]:justify-center"
              >
                <img className="h-[18px]" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li className="max-[1025px]:flex-[1_1_calc(50%_-_8px)]">
              <a
                href="https://react.dev/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-[8px] rounded-[6px] bg-(--social-bg) px-[12px] py-[6px] text-[16px] text-(--text-h) no-underline transition-shadow duration-300 hover:shadow-(--shadow) max-[1025px]:w-full max-[1025px]:justify-center"
              >
                <img className="size-[18px]" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div
          id="social"
          className="flex-[1_1_0] p-[32px] max-[1025px]:px-[20px] max-[1025px]:py-[24px]"
        >
          <svg
            className="mb-[16px] inline-block size-[22px] align-baseline"
            role="presentation"
            aria-hidden="true"
          >
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2 className="mb-[8px] [font-family:var(--heading)] text-[24px] leading-[1.18] font-medium tracking-[-0.24px] text-(--text-h) max-[1025px]:text-[20px]">
            Connect with us
          </h2>
          <p>Join the Vite community</p>
          <ul className="mt-[32px] flex list-none gap-[8px] p-0 max-[1025px]:mt-[20px] max-[1025px]:flex-wrap max-[1025px]:justify-center">
            <li className="max-[1025px]:flex-[1_1_calc(50%_-_8px)]">
              <a
                href="https://github.com/vitejs/vite"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-[8px] rounded-[6px] bg-(--social-bg) px-[12px] py-[6px] text-[16px] text-(--text-h) no-underline transition-shadow duration-300 hover:shadow-(--shadow) max-[1025px]:w-full max-[1025px]:justify-center"
              >
                <svg
                  className="size-[18px] dark:brightness-200 dark:invert"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li className="max-[1025px]:flex-[1_1_calc(50%_-_8px)]">
              <a
                href="https://chat.vite.dev/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-[8px] rounded-[6px] bg-(--social-bg) px-[12px] py-[6px] text-[16px] text-(--text-h) no-underline transition-shadow duration-300 hover:shadow-(--shadow) max-[1025px]:w-full max-[1025px]:justify-center"
              >
                <svg
                  className="size-[18px] dark:brightness-200 dark:invert"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li className="max-[1025px]:flex-[1_1_calc(50%_-_8px)]">
              <a
                href="https://x.com/vite_js"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-[8px] rounded-[6px] bg-(--social-bg) px-[12px] py-[6px] text-[16px] text-(--text-h) no-underline transition-shadow duration-300 hover:shadow-(--shadow) max-[1025px]:w-full max-[1025px]:justify-center"
              >
                <svg
                  className="size-[18px] dark:brightness-200 dark:invert"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li className="max-[1025px]:flex-[1_1_calc(50%_-_8px)]">
              <a
                href="https://bsky.app/profile/vite.dev"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-[8px] rounded-[6px] bg-(--social-bg) px-[12px] py-[6px] text-[16px] text-(--text-h) no-underline transition-shadow duration-300 hover:shadow-(--shadow) max-[1025px]:w-full max-[1025px]:justify-center"
              >
                <svg
                  className="size-[18px] dark:brightness-200 dark:invert"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="relative w-full before:absolute before:top-[-4.5px] before:left-0 before:border-[5px] before:border-transparent before:border-l-(--border) before:content-[''] after:absolute after:top-[-4.5px] after:right-0 after:border-[5px] after:border-transparent after:border-r-(--border) after:content-['']"></div>
      <section
        id="spacer"
        className="h-[88px] shrink-0 border-t border-(--border) max-[1025px]:h-[48px]"
      ></section>
    </main>
  )
}

export default App
