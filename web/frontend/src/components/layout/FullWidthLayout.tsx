import { Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../common';

export function FullWidthLayout() {
  return (
    <div className="min-h-screen">
      {/* Top Navigation */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-slate-200 dark:border-ui-border-dark px-10 py-3 bg-white dark:bg-bg-main-dark">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-4 text-slate-900 dark:text-white">
            <div className="size-6 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M13.8261 30.5736C16.7203 29.8826 20.2244 29.4783 24 29.4783C27.7756 29.4783 31.2797 29.8826 34.1739 30.5736C36.9144 31.2278 39.9967 32.7669 41.3563 33.8352L24.8486 7.36089C24.4571 6.73303 23.5429 6.73303 23.1514 7.36089L6.64374 33.8352C8.00331 32.7669 11.0856 31.2278 13.8261 30.5736Z"
                  fill="currentColor"
                />
                <path
                  clipRule="evenodd"
                  d="M39.998 35.764C39.9944 35.7463 39.9875 35.7155 39.9748 35.6706C39.9436 35.5601 39.8949 35.4259 39.8346 35.2825C39.8168 35.2403 39.7989 35.1993 39.7813 35.1602C38.5103 34.2887 35.9788 33.0607 33.7095 32.5189C30.9875 31.8691 27.6413 31.4783 24 31.4783C20.3587 31.4783 17.0125 31.8691 14.2905 32.5189C12.0012 33.0654 9.44505 34.3104 8.18538 35.1832C8.17384 35.2075 8.16216 35.233 8.15052 35.2592C8.09919 35.3751 8.05721 35.4886 8.02977 35.589C8.00356 35.6848 8.00039 35.7333 8.00004 35.7388C8.00004 35.739 8 35.7393 8.00004 35.7388C8.00004 35.7641 8.0104 36.0767 8.68485 36.6314C9.34546 37.1746 10.4222 37.7531 11.9291 38.2772C14.9242 39.319 19.1919 40 24 40C28.8081 40 33.0758 39.319 36.0709 38.2772C37.5778 37.7531 38.6545 37.1746 39.3151 36.6314C39.9006 36.1499 39.9857 35.8511 39.998 35.764Z"
                  fill="currentColor"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">DevMonitor</h2>
          </Link>
          <nav className="flex items-center gap-9">
            <Link to="/" className="text-primary text-sm font-medium leading-normal">
              Dashboard
            </Link>
            <Link
              to="/services"
              className="text-slate-500 dark:text-text-muted-dark text-sm font-medium leading-normal hover:text-slate-900 dark:hover:text-white"
            >
              Services
            </Link>
            <Link
              to="/logs"
              className="text-slate-500 dark:text-text-muted-dark text-sm font-medium leading-normal hover:text-slate-900 dark:hover:text-white"
            >
              Logs
            </Link>
            <Link
              to="/alerts"
              className="text-slate-500 dark:text-text-muted-dark text-sm font-medium leading-normal hover:text-slate-900 dark:hover:text-white"
            >
              Alerts
            </Link>
            <Link
              to="/settings"
              className="text-slate-500 dark:text-text-muted-dark text-sm font-medium leading-normal hover:text-slate-900 dark:hover:text-white"
            >
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 justify-end gap-6 items-center">
          <div className="flex w-full max-w-64">
            <div className="flex w-full flex-1 items-stretch rounded-lg h-10">
              <div className="text-slate-400 dark:text-text-muted-dark flex border-none bg-slate-100 dark:bg-bg-surface-dark items-center justify-center pl-4 rounded-l-lg">
                <MaterialIcon name="search" className="text-xl" />
              </div>
              <input
                type="text"
                placeholder="Quick search..."
                className="flex w-full min-w-0 flex-1 rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-slate-100 dark:bg-bg-surface-dark h-full placeholder:text-slate-400 dark:placeholder:text-text-muted-dark px-4 rounded-l-none pl-2 text-base font-normal"
              />
            </div>
          </div>
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary/20"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA3Ukm3oMaztawMJbG6FnWhpV49ZU_yMMNFXrkQl-yKWYEMTm7eunV_SumfRztQojTmaISWc3fEXcVttjTj-VMXb9qJtVoT1wn_gn52ihw-5cOTNpo10p-vPTQUDZrFQ6PHeXdr56YhAFBSW-25NcIbClZEjgMzZWpYq4tzor4UfyTUJn5fOn8g1Zb_59VdIAGOoNZr6eyaFUBrqV5xGd6x9BG4jMc91fFwHqqogaYdrgkg2kprQT2i4yfkyzjGVPhPxItPy7d3OXgb")',
            }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto py-8 px-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="max-w-[1200px] mx-auto mt-12 mb-12 px-6 pt-8 border-t border-slate-200 dark:border-ui-border-dark flex flex-col md:flex-row justify-between items-center text-slate-500 dark:text-text-dim-dark text-sm">
        <p>© 2023 DevMonitor Analytics Platform. All rights reserved.</p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <span>System Status</span>
          <span>API Docs</span>
          <span>Support</span>
        </div>
      </footer>
    </div>
  );
}
