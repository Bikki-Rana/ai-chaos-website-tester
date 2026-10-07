import { EmptyState } from '../components/States';

export default function SettingsPage() {
  return (
    <div className="ct-page">
      <header className="ct-pagehead">
        <div>
          <h1 className="ct-title">Settings</h1>
          <p className="ct-sub">Application preferences.</p>
        </div>
      </header>
      <section className="ct-panel">
        <EmptyState
          title="No configurable settings"
          description="Crawl limits (maximum pages and depth) are set per test on each project page."
        />
      </section>
    </div>
  );
}