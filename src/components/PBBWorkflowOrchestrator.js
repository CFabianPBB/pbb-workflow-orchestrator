import React, { useState } from 'react';
import { Upload, PlayCircle, CheckCircle, AlertCircle, Info, Download } from 'lucide-react';
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

  // Helper function to submit form data to individual apps
  const submitToApp = async (url, formData) => {
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  };

  // Helper function to extract download URL from HTML response
  const extractDownloadUrl = (html, baseUrl) => {
    console.log("🔍 Searching for download URL in HTML response...");
    
    // Multiple patterns to look for download links
    const patterns = [
      /href="([^"]*download[^"]*\.xlsx?)"/i,
      /href="([^"]*\.xlsx?)"/i,
      /href="([^"]*\/download\/[^"]*)"/i,
      /window\.location\.href\s*=\s*["']([^"']*download[^"']*)["']/i,
      /window\.location\.href\s*=\s*["']([^"']*\.xlsx?)["']/i
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        let downloadPath = match[1];
        console.log("✅ Found download path:", downloadPath);
        
        // If it's a relative URL, make it absolute
        if (downloadPath.startsWith('/')) {
          downloadPath = baseUrl + downloadPath;
        } else if (!downloadPath.startsWith('http')) {
          // Handle relative paths without leading slash
          downloadPath = baseUrl + '/' + downloadPath;
        }
        
        console.log("🔗 Final download URL:", downloadPath);
        return downloadPath;
      }
    }
    
    // Debug: Log part of the HTML to see what we're working with
    console.log("❌ No download URL found. HTML snippet:", html.substring(0, 1000));
    return null;
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
    let inventoryFile = null;
    let costingFile = null;
    let scoringFile = null;
    
    try {
      // Step 1: Program Inventory Agent
      setAgentStatus(prev => ({...prev, programInventory: 'running'}));
      console.log("🚀 Submitting to Program Inventory App...");
      
      try {
        // Create form data for Program Inventory (matching the individual app's form)
        const inventoryFormData = new FormData();
        inventoryFormData.append('file', files.personnel); // Main file upload
        inventoryFormData.append('website_url', files.website || 'https://www.example.gov'); // Website URL
        inventoryFormData.append('programs_per_department', '5'); // Default value
        
        console.log("📤 Sending form data to:", appUrls.programInventory);
        console.log("📋 Form data contents:");
        console.log("  - File:", files.personnel.name);
        console.log("  - Website:", files.website || 'https://www.example.gov');
        console.log("  - Programs per dept: 5");
        
        // Submit to Program Inventory app
        const inventoryResponse = await submitToApp(appUrls.programInventory, inventoryFormData);
        const inventoryHtml = await inventoryResponse.text();
        
        console.log("📥 Program Inventory Response received");
        console.log("📄 Response status:", inventoryResponse.status);
        console.log("🔗 Response URL:", inventoryResponse.url);
        
        // Check if we got redirected to a success page
        if (inventoryResponse.url.includes('/task/') || inventoryResponse.url.includes('/download/')) {
          console.log("✅ Looks like we got a task/download URL directly!");
          // If the response URL itself is the download page, try to extract from that
          if (inventoryResponse.url.includes('/download/')) {
            const inventoryDownloadUrl = inventoryResponse.url;
            console.log("🎯 Using response URL as download URL:", inventoryDownloadUrl);
        
            // Download the file to pass to next step
            const fileResponse = await fetch(inventoryDownloadUrl);
            if (!fileResponse.ok) {
              throw new Error(`Failed to download file: ${fileResponse.status}`);
            }
            const blob = await fileResponse.blob();
            inventoryFile = new File([blob], 'program_inventory.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            setAgentStatus(prev => ({...prev, programInventory: 'completed'}));
            setOutputFiles(prev => ({
              ...prev, 
              programInventory: {
                name: 'program_inventory.xlsx',
                downloadUrl: inventoryDownloadUrl
              }
            }));
          } else {
            // Try to extract download URL from HTML
            const inventoryDownloadUrl = extractDownloadUrl(inventoryHtml, appUrls.programInventory);
            
            if (inventoryDownloadUrl) {
              console.log("✅ Program Inventory Download URL found:", inventoryDownloadUrl);
              
              // Download the file to pass to next step
              const fileResponse = await fetch(inventoryDownloadUrl);
              if (!fileResponse.ok) {
                throw new Error(`Failed to download file: ${fileResponse.status}`);
              }
              const blob = await fileResponse.blob();
              inventoryFile = new File([blob], 'program_inventory.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              
              setAgentStatus(prev => ({...prev, programInventory: 'completed'}));
              setOutputFiles(prev => ({
                ...prev, 
                programInventory: {
                  name: 'program_inventory.xlsx',
                  downloadUrl: inventoryDownloadUrl
                }
              }));
            } else {
              throw new Error("Could not find download URL in Program Inventory response");
            }
          }
      } catch (error) {
        console.error("❌ Program Inventory Error:", error);
        setAgentStatus(prev => ({...prev, programInventory: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programInventory: `Error: ${error.message}`
        }));
        throw new Error("Program Inventory step failed");
      }
      
      // Step 2: Cost Allocation Agent
      setAgentStatus(prev => ({...prev, costAllocation: 'running'}));
      console.log("🚀 Submitting to Cost Allocation App...");
      
      try {
        // Create form data for Cost Allocation
        const costFormData = new FormData();
        costFormData.append('program_inventory', inventoryFile);
        costFormData.append('department_budget', files.departmentBudget);
        costFormData.append('organization_name', orgName);
        
        console.log("📤 Sending form data to:", appUrls.costAllocation);
        
        // Submit to Cost Allocation app
        const costResponse = await submitToApp(appUrls.costAllocation, costFormData);
        const costHtml = await costResponse.text();
        
        console.log("📥 Cost Allocation Response received");
        
        // Extract download URL from response
        const costDownloadUrl = extractDownloadUrl(costHtml, appUrls.costAllocation);
        
        if (costDownloadUrl) {
          console.log("✅ Cost Allocation Download URL found:", costDownloadUrl);
          
          // Download the file to pass to next step
          const fileResponse = await fetch(costDownloadUrl);
          const blob = await fileResponse.blob();
          costingFile = new File([blob], 'program_costs.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          
          setAgentStatus(prev => ({...prev, costAllocation: 'completed'}));
          setOutputFiles(prev => ({
            ...prev, 
            costAllocation: {
              name: 'program_costs.xlsx',
              downloadUrl: costDownloadUrl
            }
          }));
        } else {
          throw new Error("Could not find download URL in Cost Allocation response");
        }
      } catch (error) {
        console.error("❌ Cost Allocation Error:", error);
        setAgentStatus(prev => ({...prev, costAllocation: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          costAllocation: `Error: ${error.message}`
        }));
        throw new Error("Cost Allocation step failed");
      }
      
      // Step 3: Program Scoring Agent
      setAgentStatus(prev => ({...prev, programScoring: 'running'}));
      console.log("🚀 Submitting to Program Scoring App...");
      
      try {
        // Create form data for Program Scoring
        const scoringFormData = new FormData();
        scoringFormData.append('file', costingFile);
        scoringFormData.append('organization_name', orgName);
        
        console.log("📤 Sending form data to:", appUrls.programScoring);
        
        // Submit to Program Scoring app
        const scoringResponse = await submitToApp(appUrls.programScoring, scoringFormData);
        const scoringHtml = await scoringResponse.text();
        
        console.log("📥 Program Scoring Response received");
        
        // Extract download URL from response
        const scoringDownloadUrl = extractDownloadUrl(scoringHtml, appUrls.programScoring);
        
        if (scoringDownloadUrl) {
          console.log("✅ Program Scoring Download URL found:", scoringDownloadUrl);
          
          // Download the file to pass to next step
          const fileResponse = await fetch(scoringDownloadUrl);
          const blob = await fileResponse.blob();
          scoringFile = new File([blob], 'program_scores.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          
          setAgentStatus(prev => ({...prev, programScoring: 'completed'}));
          setOutputFiles(prev => ({
            ...prev, 
            programScoring: {
              name: 'program_scores.xlsx',
              downloadUrl: scoringDownloadUrl
            }
          }));
        } else {
          throw new Error("Could not find download URL in Program Scoring response");
        }
      } catch (error) {
        console.error("❌ Program Scoring Error:", error);
        setAgentStatus(prev => ({...prev, programScoring: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programScoring: `Error: ${error.message}`
        }));
        throw new Error("Program Scoring step failed");
      }
      
      // Step 4: Program Insight Agent
      setAgentStatus(prev => ({...prev, programInsight: 'running'}));
      console.log("🚀 Submitting to Program Insight App...");
      
      try {
        // Create form data for Program Insight
        const insightFormData = new FormData();
        insightFormData.append('file', scoringFile);
        insightFormData.append('organization_name', orgName);
        
        console.log("📤 Sending form data to:", appUrls.programInsight);
        
        // Submit to Program Insight app
        const insightResponse = await submitToApp(appUrls.programInsight, insightFormData);
        const insightHtml = await insightResponse.text();
        
        console.log("📥 Program Insight Response received");
        
        // Extract download URL from response
        const insightDownloadUrl = extractDownloadUrl(insightHtml, appUrls.programInsight);
        
        if (insightDownloadUrl) {
          console.log("✅ Program Insight Download URL found:", insightDownloadUrl);
          
          setAgentStatus(prev => ({...prev, programInsight: 'completed'}));
          setOutputFiles(prev => ({
            ...prev, 
            programInsight: {
              name: 'program_insights.xlsx',
              downloadUrl: insightDownloadUrl
            }
          }));
        } else {
          throw new Error("Could not find download URL in Program Insight response");
        }
      } catch (error) {
        console.error("❌ Program Insight Error:", error);
        setAgentStatus(prev => ({...prev, programInsight: 'error'}));
        setErrorMessages(prev => ({
          ...prev,
          programInsight: `Error: ${error.message}`
        }));
        throw new Error("Program Insight step failed");
      }
      
      setCurrentStep(4); // All steps completed
      console.log("🎉 All workflows completed successfully!");
      
    } catch (error) {
      console.error("❌ Workflow error:", error);
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
                  <a 
                    href={outputFiles.programInventory.downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Download className="w-4 h-4 mr-1" />
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
                  <a 
                    href={outputFiles.costAllocation.downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Download className="w-4 h-4 mr-1" />
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
                  <a 
                    href={outputFiles.programScoring.downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Download className="w-4 h-4 mr-1" />
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
                  <a 
                    href={outputFiles.programInsight.downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Download className="w-4 h-4 mr-1" />
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