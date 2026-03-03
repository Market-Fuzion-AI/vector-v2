/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import Dashboard from './components/Dashboard';
import { AuthGate } from './components/AuthGate';

export default function App() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
