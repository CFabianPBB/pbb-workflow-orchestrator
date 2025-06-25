import React, { useState } from 'react';
import { Upload, PlayCircle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import ApiService from '../services/apiService';
import config from '../config';

const PBBWorkflowOrchestrator = () => {
  // Get URLs from config
  const appUrls = config.apiUrls;

  // State management
  const [orgName, setOrgName] = useState('');
  const [files, setFiles] = useState({
    personnel: null,
    website: '',
    departmentBudget: null
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [agentStatus, setAgentStatus] = useState({
    programInventory: 'idle', // idle, running, completed, error
    costAllocation: 'idle',
    programScoring: 'idle',
    programInsight: 'idle'
  });
  const [outputFiles, setOutputFiles] = useState({
    programInventory: null,
    costAllocation: null,
    programScoring: null,
    programInsight: null
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessages, setErrorMessages] = useState({
    programInventory: '',
    costAllocation: '',
    programScoring: '',
    programInsight: ''
  });
  // File upload handlers
  const handlePersonnelUpload = (e) => {
    if (e.target.files[0]) {
      setFiles({...files, personnel: e.target.files[0]});
    }
  };

  const handleBudgetUpload = (e) => {
    if (e.target.files[0]) {
      setFiles({...files, departmentBudget: e.target.files[0]});
    }
  };

  const handleWebsiteInput = (e) => {
    setFiles({...files, website: e.target.value});
  };

  const handleOrgNameInput = (e) => {
    setOrgName(e.target.value);
  };

  // Check if ready to start workflow
  const isReadyToStart = () => {
    return files.personnel && files.departmentBudget && orgName;
  };
  // Run workflow
  const runWorkflow = async () => {
    if (!isReadyToStart()) return;
    
    setIsProcessing(true);
    // Reset all statuses and errors
    setAgentStatus({
      programInventory: 'idle',
      costAllocation: 'idle',
      programScoring: 'idle',
      programInsight: 'idle'
    });
    setErrorMessages({
      programInventory: '',
      costAllocation: '',
      programScoring: '',
      programInsight: ''
    });
    
    // Store data for passing between steps
    let inventoryData = null;
    let costingData = null;
    let scoringData = null;
    
    try {
      // Step 1: Program Inventory Agent
      setAgentStatus(prev => ({...prev, programInventory: 'running'}));
      console.log("Calling Program Inventory API at:", appUrls.programInventory);
      
      try {
        const inventoryResponse = await ApiService.programInventory.generateInventory(
          files.personnel,
          files.website,
          orgName
        );
        
        inventoryData = inventoryResponse.inventory_data;
        
        setAgentStatus(prev => ({...prev, programInventory: 'completed'}));
        setOutputFiles(prev => ({
          ...prev, 
          programInventory: {
            name: 'program_inventory.xlsx',
            downloadUrl: inventoryResponse.download_url,
            data: inventoryData
          }
        }));
      } catch (error) {
        console.error("Program Inventory API Error:", error);
        setAgentStatus(prev => ({...prev, programInventory: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programInventory: `Error: ${error.response?.data?.error || error.message}`
        }));
        throw new Error("Program Inventory step failed");
      }
      
      // Step 2: Cost Allocation Agent
      setAgentStatus(prev => ({...prev, costAllocation: 'running'}));
      console.log("Calling Cost Allocation API at:", appUrls.costAllocation);
      
      try {
        // Pass inventory data to the cost allocation service
        const costingResponse = await ApiService.costAllocation.allocateCosts(
          inventoryData, 
          files.departmentBudget,
          orgName
        );
        
        costingData = costingResponse.cost_data;
        
        setAgentStatus(prev => ({...prev, costAllocation: 'completed'}));
        setOutputFiles(prev => ({
          ...prev, 
          costAllocation: {
            name: 'program_costs.xlsx',
            downloadUrl: costingResponse.download_url,
            data: costingData
          }
        }));
      } catch (error) {
        console.error("Cost Allocation API Error:", error);
        setAgentStatus(prev => ({...prev, costAllocation: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          costAllocation: `Error: ${error.response?.data?.error || error.message}`
        }));
        throw new Error("Cost Allocation step failed");
      }
      
      // Step 3: Program Scoring Agent
      setAgentStatus(prev => ({...prev, programScoring: 'running'}));
      console.log("Calling Program Scoring API at:", appUrls.programScoring);
      
      try {
        // Pass costing data to the program scoring service
        const scoringResponse = await ApiService.programScoring.evaluatePrograms(
          costingData,
          orgName
        );
        
        scoringData = scoringResponse.scoring_data;
        
        setAgentStatus(prev => ({...prev, programScoring: 'completed'}));
        setOutputFiles(prev => ({
          ...prev, 
          programScoring: {
            name: 'program_scores.xlsx',
            downloadUrl: scoringResponse.download_url,
            data: scoringData
          }
        }));
      } catch (error) {
        console.error("Program Scoring API Error:", error);
        setAgentStatus(prev => ({...prev, programScoring: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programScoring: `Error: ${error.response?.data?.error || error.message}`
        }));
        throw new Error("Program Scoring step failed");
      }
      
      // Step 4: Program Insight Agent
      setAgentStatus(prev => ({...prev, programInsight: 'running'}));
      console.log("Calling Program Insight API at:", appUrls.programInsight);
      
      try {
        // Pass scoring data to the program insight service
        const insightResponse = await ApiService.programInsight.generateInsights(
          scoringData,
          orgName
        );
        
        setAgentStatus(prev => ({...prev, programInsight: 'completed'}));
        setOutputFiles(prev => ({
          ...prev, 
          programInsight: {
            name: 'program_insights.xlsx',
            downloadUrl: insightResponse.download_url,
            data: insightResponse.insight_data
          }
        }));
      } catch (error) {
        console.error("Program Insight API Error:", error);
        setAgentStatus(prev => ({...prev, programInsight: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programInsight: `Error: ${error.response?.data?.error || error.message}`
        }));
        throw new Error("Program Insight step failed");
      }
      
      setCurrentStep(4); // All steps completed
    } catch (error) {
      console.error("Workflow error:", error);
      // Main error handling is done in each step
    } finally {
      setIsProcessing(false);
    }
  };

  // Status icon component
  const StatusIcon = ({ status }) => {
    if (status === 'idle') return null;
    if (status === 'running') return <PlayCircle className="text-blue-500" />;
    if (status === 'completed') return <CheckCircle className="text-green-500" />;
    if (status === 'error') return <AlertCircle className="text-red-500" />;
    return null;
  };
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">PBB Agentic Workflow Orchestrator</h1>
        <p className="text-gray-600">
          Upload your data sources and let our AI agents automate your Priority-Based Budgeting process.
        </p>
      </div>

      {/* Input Section */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Input Data</h2>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Organization Name</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="Enter organization name"
            value={orgName}
            onChange={handleOrgNameInput}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">Personnel Data (Excel)</label>
            <div className="flex items-center">
              <label className="flex items-center px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
                <Upload size={16} className="mr-2" />
                Browse
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handlePersonnelUpload}
                />
              </label>
              <span className="ml-2 text-sm text-gray-600">
                {files.personnel ? files.personnel.name : 'No file selected'}
              </span>
            </div>
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2">Department Budget (Excel)</label>
            <div className="flex items-center">
              <label className="flex items-center px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
                <Upload size={16} className="mr-2" />
                Browse
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleBudgetUpload}
                />
              </label>
              <span className="ml-2 text-sm text-gray-600">
                {files.departmentBudget ? files.departmentBudget.name : 'No file selected'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-gray-700 mb-2">Organization Website (Optional)</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="https://example.org"
            value={files.website}
            onChange={handleWebsiteInput}
          />
        </div>
      </div>

      {/* Workflow Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Workflow Status</h2>
          <button
            className={`px-6 py-2 rounded font-medium ${
              isReadyToStart() && !isProcessing
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={runWorkflow}
            disabled={!isReadyToStart() || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Run Workflow'}
          </button>
        </div>

        {/* Workflow Steps */}
        <div className="space-y-6">
          {/* Step 1: Program Inventory Agent */}
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 mr-4">1</div>
                <div>
                  <h3 className="font-medium">Program Inventory Agent</h3>
                  <p className="text-sm text-gray-500">Creates program inventory from personnel data</p>
                </div>
              </div>
              <div className="flex items-center">
                <StatusIcon status={agentStatus.programInventory} />
                {outputFiles.programInventory && (
                  <a href={outputFiles.programInventory.downloadUrl} className="ml-4 text-blue-500 hover:underline text-sm">
                    Download Output
                  </a>
                )}
              </div>
            </div>
            {errorMessages.programInventory && (
              <div className="mt-2 text-sm text-red-500">{errorMessages.programInventory}</div>
            )}
          </div>

          {/* Step 2: Cost Allocation Agent */}
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 mr-4">2</div>
                <div>
                  <h3 className="font-medium">Cost Allocation Agent</h3>
                  <p className="text-sm text-gray-500">Allocates costs to programs</p>
                </div>
              </div>
              <div className="flex items-center">
                <StatusIcon status={agentStatus.costAllocation} />
                {outputFiles.costAllocation && (
                  <a href={outputFiles.costAllocation.downloadUrl} className="ml-4 text-blue-500 hover:underline text-sm">
                    Download Output
                  </a>
                )}
              </div>
            </div>
            {errorMessages.costAllocation && (
              <div className="mt-2 text-sm text-red-500">{errorMessages.costAllocation}</div>
            )}
          </div>

          {/* Step 3: Program Scoring Agent */}
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 mr-4">3</div>
                <div>
                  <h3 className="font-medium">Program Scoring Agent</h3>
                  <p className="text-sm text-gray-500">Evaluates and scores programs</p>
                </div>
              </div>
              <div className="flex items-center">
                <StatusIcon status={agentStatus.programScoring} />
                {outputFiles.programScoring && (
                  <a href={outputFiles.programScoring.downloadUrl} className="ml-4 text-blue-500 hover:underline text-sm">
                    Download Output
                  </a>
                )}
              </div>
            </div>
            {errorMessages.programScoring && (
              <div className="mt-2 text-sm text-red-500">{errorMessages.programScoring}</div>
            )}
          </div>
          
          {/* Step 4: Program Insight Agent */}
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 mr-4">4</div>
                <div>
                  <h3 className="font-medium">Program Insight Agent</h3>
                  <p className="text-sm text-gray-500">Generates program insights and opportunities</p>
                </div>
              </div>
              <div className="flex items-center">
                <StatusIcon status={agentStatus.programInsight} />
                {outputFiles.programInsight && (
                  <a href={outputFiles.programInsight.downloadUrl} className="ml-4 text-blue-500 hover:underline text-sm">
                    Download Output
                  </a>
                )}
              </div>
            </div>
            {errorMessages.programInsight && (
              <div className="mt-2 text-sm text-red-500">{errorMessages.programInsight}</div>
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex">
        <Info className="text-blue-500 mr-3 flex-shrink-0 mt-1" />
        <div>
          <h4 className="font-medium text-blue-800">How the Process Works</h4>
          <p className="text-sm text-blue-700">
            This application orchestrates four AI agents that work sequentially:
            1) Program Inventory Agent creates a program inventory from personnel data,
            2) Cost Allocation Agent allocates costs to each program,
            3) Program Scoring Agent evaluates and scores programs, and
            4) Program Insight Agent generates strategic insights and opportunities.
          </p>
        </div>
      </div>
      
      {/* Links to Individual Apps */}
      <div className="mt-6 p-4 bg-gray-50 border rounded-lg">
        <h4 className="font-medium mb-3">Access Individual Applications</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a href={appUrls.programInventory} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 mr-2">1</div>
            Program Inventory Generator
          </a>
          <a href={appUrls.costAllocation} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 mr-2">2</div>
            Budget Allocation App
          </a>
          <a href={appUrls.programScoring} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 mr-2">3</div>
            Program Evaluation Predictor
          </a>
          <a href={appUrls.programInsight} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
            <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-500 mr-2">4</div>
            Program Insights Predictor
          </a>
        </div>
      </div>
    </div>
  );
};

export default PBBWorkflowOrchestrator;