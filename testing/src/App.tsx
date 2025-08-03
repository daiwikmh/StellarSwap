import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import RevolverSwap from './components/swaps/swaps';
import CrossChainInterface from './components/crosschain/CrossChainInterface';

const LandingPage = () => <div>Landing Page - Under Construction</div>;
const DashboardPage = () => <div>Dashboard Page - Under Construction</div>;

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/page" element={<DashboardPage />} /> 
                <Route path="/dashboard" element={<LandingPage/>} />
                <Route path="/" element={<RevolverSwap />} />
                <Route path="/crosschain" element={<CrossChainInterface />} />
            </Routes>
        </Router>
    );
};

export default App;