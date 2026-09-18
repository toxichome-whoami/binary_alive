import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer
      className="h-12 shrink-0 bg-[#000000] border-t border-[#222222] mt-auto px-4 md:px-6 flex items-center justify-center select-none"
      id="site-footer"
      data-sentry-component="SiteFooter"
      data-sentry-source-file="Footer.tsx"
    >
      <div className="w-full flex items-center justify-center">
        <ul className="m-0 p-0 flex items-center justify-center flex-wrap list-none text-[13px] leading-none">
          {/* Documentation */}
          <li className="flex items-center">
            <a
              className="text-[#cccccc] hover:text-white transition-colors whitespace-nowrap no-underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/toxichome-whoami/binary_alive#readme"
            >
              Documentation
            </a>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* GitHub */}
          <li className="flex items-center">
            <a
              className="group flex items-center gap-1.5 text-[#cccccc] hover:text-white transition-colors whitespace-nowrap no-underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/toxichome-whoami/binary_alive"
            >
              <svg
                className="w-3.5 h-3.5 text-[#8c8c8c] group-hover:text-white transition-colors"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span>GitHub</span>
            </a>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* Copyright */}
          <li className="flex items-center">
            <span className="text-[13px] text-[#737373] whitespace-nowrap leading-none">
              © 2026 toxichome
            </span>
          </li>
        </ul>
      </div>
    </footer>
  );
};
