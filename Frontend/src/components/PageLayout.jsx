import { Outlet } from 'react-router-dom';
import SiteFooter from './SiteFooter.jsx';
import SiteHeader from './SiteHeader.jsx';

export default function PageLayout() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SiteHeader />
      <main id="main-content">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}
