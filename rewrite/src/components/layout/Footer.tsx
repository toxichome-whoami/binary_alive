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
          {/* Support */}
          <li className="flex items-center">
            <a
              className="text-[#f3f4f6] hover:text-[#a3a3a3] transition-colors whitespace-nowrap no-underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://support.cloudflare.com"
            >
              Support
            </a>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* System status */}
          <li className="flex items-center">
            <a
              className="text-[#f3f4f6] hover:text-[#a3a3a3] transition-colors whitespace-nowrap no-underline capitalize"
              target="_blank"
              rel="noopener noreferrer"
              href="https://www.cloudflarestatus.com"
            >
              System status
            </a>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* Careers */}
          <li className="flex items-center">
            <a
              className="text-[#f3f4f6] hover:text-[#a3a3a3] transition-colors whitespace-nowrap no-underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://www.cloudflare.com/careers/"
            >
              Careers
            </a>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* Terms of Use */}
          <li className="flex items-center">
            <a
              className="text-[#f3f4f6] hover:text-[#a3a3a3] transition-colors whitespace-nowrap no-underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://www.cloudflare.com/website-terms/"
            >
              Terms of Use
            </a>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* Report Security Issues */}
          <li className="flex items-center">
            <a
              className="text-[#f3f4f6] hover:text-[#a3a3a3] transition-colors whitespace-nowrap no-underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://www.cloudflare.com/disclosure/"
            >
              Report Security Issues
            </a>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* Privacy Policy */}
          <li className="flex items-center">
            <a
              className="text-[#f3f4f6] hover:text-[#a3a3a3] transition-colors whitespace-nowrap no-underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://www.cloudflare.com/privacypolicy/"
            >
              Privacy Policy
            </a>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* Cookie Preferences with exact OneTrust Privacy Choices pill */}
          <li className="flex items-center">
            <button
              type="button"
              id="ot-sdk-btn"
              className="text-[#4693ff] hover:underline flex items-center gap-1.5 text-[13px] font-normal cursor-pointer bg-transparent border-0 p-0 whitespace-nowrap"
            >
              <svg
                width="26"
                height="12"
                viewBox="0 0 30 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-[26px] h-[12px] shrink-0 inline-block"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  fill="#0066FF"
                  d="M22.6 0H7.4C3.5 0 .4 3.1.4 7s3.1 7 7 7h15.2c3.9 0 7-3.1 7-7s-3.2-7-7-7z"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  fill="#FFFFFF"
                  d="M7.4 12.8h6.8l3.1-11.6H7.4C4.2 1.2 1.6 3.8 1.6 7s2.6 5.8 5.8 5.8z"
                />
                <path
                  fill="#FFFFFF"
                  d="M24.6 4c.2.2.2.6 0 .8l-2.1 2.2 2.2 2.2c.2.2.2.6 0 .8s-.6.2-.8 0l-2.2-2.2-2.2 2.2c-.2.2-.6.2-.8 0s-.2-.6 0-.8l2.1-2.2-2.2-2.2c-.2-.2-.2-.6 0-.8s.6-.2.8 0l2.2 2.2 2.2-2.2c.2-.2.6-.2.8 0z"
                />
                <path
                  fill="#0066FF"
                  d="M12.7 4.1c.2.2.3.6.1.8l-4.2 4.9c-.1.1-.2.2-.3.2-.2.1-.5.1-.7-.1L5.4 7.7c-.2-.2-.2-.6 0-.8s.6-.2.8 0l1.8 1.7 3.8-4.5c.2-.2.6-.2.9 0z"
                />
              </svg>
              <span className="whitespace-nowrap leading-none">Cookie Preferences</span>
            </button>
          </li>

          {/* Divider */}
          <li aria-hidden="true" className="h-3.5 w-px bg-[#262626] mx-3.5 shrink-0" />

          {/* Copyright */}
          <li className="flex items-center">
            <span className="text-[13px] text-[#8c8c8c] whitespace-nowrap leading-none">
              © 2026 Cloudflare, Inc.
            </span>
          </li>
        </ul>
      </div>
    </footer>
  );
};
