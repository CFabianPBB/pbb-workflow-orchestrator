import React, { useState } from 'react';
import { Upload, PlayCircle, CheckCircle, AlertCircle, Info, Download } from 'lucide-react';
import config from '../config';

const PBBWorkflowOrchestrator = () => {
  const appUrls = config.apiUrls;

  const [orgName, setOrgName] = useState('');
  const [files, setFiles] = useState({
    personnel: null,
    website: ''
  });
  const [isRunning, setIsRunning] = useState(false);
  const [agentStatus, setAgentStatus] = useState({
    programInventory: 'idle',
    costAllocation: 'idle',
    prioritization: 'idle',
    budgetOptimization: 'idle'
  });
  const [outputFiles, setOutputFiles] = useState({
    programInventory: null,
    costAllocation: null,
    prioritization: null,
    budgetOptimization: null
  });
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'running':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300"></div>;
    }
  };

  const updateAgentStatus = (agent, status) => {
    setAgentStatus(prev => ({ ...prev, [agent]: status }));
  };

  const submitToApp = async (url, formData) => {
    // For non-file steps, try a simple proxy approach
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    
    try {
      const response = await fetch(proxyUrl + encodeURIComponent(url), {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'omit'
      });
      
      console.log("✅ Proxy method successful");
      return response;
    } catch (error) {
      console.log("❌ Proxy method failed:", error.message);
      throw error;
    }
  };

  const handleFileUpload = (type, event) => {
    const file = event.target.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      addLog(`${type === 'personnel' ? 'Personnel' : 'Website'} file uploaded: ${file.name}`);
    }
  };

  const handleWebsiteUrlChange = (url) => {
    setFiles(prev => ({ ...prev, website: url }));
    addLog(`Website URL set: ${url}`);
  };

  const runWorkflow = async () => {
    if (!files.personnel || !orgName) {
      addLog('❌ Please upload personnel file and enter organization name');
      return;
    }

    setIsRunning(true);
    addLog('🚀 Starting PBB Workflow...');

    try {
      // Step 1: Program Inventory Agent - MANUAL COMPLETION
      addLog('📝 Step 1: Program Inventory Agent...');
      updateAgentStatus('programInventory', 'error');
      
      setOutputFiles(prev => ({
        ...prev,
        programInventory: { 
          downloadUrl: 'manual',
          filename: 'Complete this step manually',
          manualUrl: appUrls.programInventory,
          manualInstructions: 'File uploads cannot be automated across domains. Please complete Step 1 manually.'
        }
      }));
      addLog('⚠️ Step 1 requires manual completion due to browser security restrictions');
      addLog('💡 Click "Complete Manually" to upload your file and get the download');

      // Step 2: Cost Allocation Agent
      addLog('💰 Step 2: Running Cost Allocation Agent...');
      updateAgentStatus('costAllocation', 'running');

      try {
        const costFormData = new FormData();
        costFormData.append('file', files.personnel);

        const costResponse = await submitToApp(appUrls.costAllocation, costFormData);
        const costText = await costResponse.text();

        // Extract download URL for cost allocation
        const costDownloadMatch = costText.match(/href="([^"]*get-file[^"]*\.xlsx)"/);
        if (costDownloadMatch) {
          let costDownloadUrl = costDownloadMatch[1];
          if (costDownloadUrl.startsWith('/')) {
            const baseUrl = new URL(appUrls.costAllocation).origin;
            costDownloadUrl = baseUrl + costDownloadUrl;
          }

          updateAgentStatus('costAllocation', 'completed');
          setOutputFiles(prev => ({
            ...prev,
            costAllocation: { 
              downloadUrl: costDownloadUrl,
              filename: 'Cost_Allocation.xlsx'
            }
          }));
          addLog('✅ Cost Allocation Agent completed successfully');
        } else {
          throw new Error('Could not find download URL in Cost Allocation response');
        }

      } catch (costError) {
        console.log("❌ Cost Allocation Error:", costError);
        updateAgentStatus('costAllocation', 'error');
        addLog(`❌ Cost Allocation Agent failed: ${costError.message}`);
      }

      // Step 3: Prioritization Agent
      addLog('📊 Step 3: Running Prioritization Agent...');
      updateAgentStatus('prioritization', 'running');

      try {
        const prioritizationFormData = new FormData();
        prioritizationFormData.append('file', files.personnel);

        const prioritizationResponse = await submitToApp(appUrls.prioritization, prioritizationFormData);
        const prioritizationText = await prioritizationResponse.text();

        // Extract download URL for prioritization
        const prioritizationDownloadMatch = prioritizationText.match(/href="([^"]*get-file[^"]*\.xlsx)"/);
        if (prioritizationDownloadMatch) {
          let prioritizationDownloadUrl = prioritizationDownloadMatch[1];
          if (prioritizationDownloadUrl.startsWith('/')) {
            const baseUrl = new URL(appUrls.prioritization).origin;
            prioritizationDownloadUrl = baseUrl + prioritizationDownloadUrl;
          }

          updateAgentStatus('prioritization', 'completed');
          setOutputFiles(prev => ({
            ...prev,
            prioritization: { 
              downloadUrl: prioritizationDownloadUrl,
              filename: 'Prioritization_Analysis.xlsx'
            }
          }));
          addLog('✅ Prioritization Agent completed successfully');
        } else {
          throw new Error('Could not find download URL in Prioritization response');
        }

      } catch (prioritizationError) {
        console.log("❌ Prioritization Error:", prioritizationError);
        updateAgentStatus('prioritization', 'error');
        addLog(`❌ Prioritization Agent failed: ${prioritizationError.message}`);
      }

      // Step 4: Budget Optimization Agent
      addLog('🎯 Step 4: Running Budget Optimization Agent...');
      updateAgentStatus('budgetOptimization', 'running');

      try {
        const budgetFormData = new FormData();
        budgetFormData.append('file', files.personnel);

        const budgetResponse = await submitToApp(appUrls.budgetOptimization, budgetFormData);
        const budgetText = await budgetResponse.text();

        // Extract download URL for budget optimization
        const budgetDownloadMatch = budgetText.match(/href="([^"]*get-file[^"]*\.xlsx)"/);
        if (budgetDownloadMatch) {
          let budgetDownloadUrl = budgetDownloadMatch[1];
          if (budgetDownloadUrl.startsWith('/')) {
            const baseUrl = new URL(appUrls.budgetOptimization).origin;
            budgetDownloadUrl = baseUrl + budgetDownloadUrl;
          }

          updateAgentStatus('budgetOptimization', 'completed');
          setOutputFiles(prev => ({
            ...prev,
            budgetOptimization: { 
              downloadUrl: budgetDownloadUrl,
              filename: 'Budget_Optimization.xlsx'
            }
          }));
          addLog('✅ Budget Optimization Agent completed successfully');
        } else {
          throw new Error('Could not find download URL in Budget Optimization response');
        }

      } catch (budgetError) {
        console.log("❌ Budget Optimization Error:", budgetError);
        updateAgentStatus('budgetOptimization', 'error');
        addLog(`❌ Budget Optimization Agent failed: ${budgetError.message}`);
      }

      addLog('🎉 PBB Workflow completed!');
      addLog('💡 Step 1 requires manual completion - other steps automated');

    } catch (error) {
      addLog(`❌ Workflow failed: ${error.message}`);
      console.error('Workflow error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Priority-Based Budgeting Workflow Orchestrator
            </h1>
            <p className="text-lg text-gray-600">
              Automated AI-powered budget analysis and optimization for {orgName || 'your organization'}
            </p>
          </div>

          {/* Input Section */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Input Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter your organization name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website URL (Optional)
                </label>
                <input
                  type="url"
                  value={files.website}
                  onChange={(e) => handleWebsiteUrlChange(e.target.value)}
                  placeholder="https://your-organization.gov"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personnel Data File
                </label>
                <div className="flex items-center">
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(e) => handleFileUpload('personnel', e)}
                    className="hidden"
                    id="personnel-upload"
                  />
                  <label
                    htmlFor="personnel-upload"
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Personnel File
                  </label>
                  {files.personnel && (
                    <span className="ml-3 text-sm text-gray-600">
                      {files.personnel.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={runWorkflow}
                disabled={!files.personnel || !orgName || isRunning}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <PlayCircle className="h-5 w-5 mr-2" />
                {isRunning ? 'Running Workflow...' : 'Run PBB Workflow'}
              </button>
            </div>
          </div>

          {/* Workflow Status */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Workflow Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">Program Inventory</h3>
                  <StatusIcon status={agentStatus.programInventory} />
                </div>
                <p className="text-sm text-gray-600">Analyze personnel data and generate program inventory</p>
                <div className="flex items-center mt-2">
                  <StatusIcon status={agentStatus.programInventory} />
                  {outputFiles.programInventory && outputFiles.programInventory.downloadUrl === 'manual' ? (
                    <a 
                      href={outputFiles.programInventory.manualUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 flex items-center px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
                    >
                      🔗 Complete Manually
                    </a>
                  ) : outputFiles.programInventory && (
                    <a 
                      href={outputFiles.programInventory.downloadUrl} 
                      download={outputFiles.programInventory.filename}
                      className="ml-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">Cost Allocation</h3>
                  <StatusIcon status={agentStatus.costAllocation} />
                </div>
                <p className="text-sm text-gray-600">Allocate personnel costs to programs</p>
                <div className="flex items-center mt-2">
                  <StatusIcon status={agentStatus.costAllocation} />
                  {outputFiles.costAllocation && (
                    <a 
                      href={outputFiles.costAllocation.downloadUrl} 
                      download={outputFiles.costAllocation.filename}
                      className="ml-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">Prioritization</h3>
                  <StatusIcon status={agentStatus.prioritization} />
                </div>
                <p className="text-sm text-gray-600">Analyze and rank program priorities</p>
                <div className="flex items-center mt-2">
                  <StatusIcon status={agentStatus.prioritization} />
                  {outputFiles.prioritization && (
                    <a 
                      href={outputFiles.prioritization.downloadUrl} 
                      download={outputFiles.prioritization.filename}
                      className="ml-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-800">Budget Optimization</h3>
                  <StatusIcon status={agentStatus.budgetOptimization} />
                </div>
                <p className="text-sm text-gray-600">Generate optimized budget recommendations</p>
                <div className="flex items-center mt-2">
                  <StatusIcon status={agentStatus.budgetOptimization} />
                  {outputFiles.budgetOptimization && (
                    <a 
                      href={outputFiles.budgetOptimization.downloadUrl} 
                      download={outputFiles.budgetOptimization.filename}
                      className="ml-2 flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Execution Log */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Execution Log</h2>
            <div className="bg-black text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500">Ready to run workflow...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PBBWorkflowOrchestrator;