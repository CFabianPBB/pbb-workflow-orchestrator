import React, { useState } from 'react';
import { Upload, PlayCircle, CheckCircle, AlertCircle, Info, Download } from 'lucide-react';
import config from '../config';

const PBBWorkflowOrchestrator = () => {
  const appUrls = config.apiUrls;

  const [orgName, setOrgName] = useState('');
  const [files, setFiles] = useState({
    personnel: null,
    website: '',
    departmentBudget: null
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [agentStatus, setAgentStatus] = useState({
    programInventory: 'idle',
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

  const isReadyToStart = () => {
    return files.personnel && files.departmentBudget && orgName;
  };

  const submitToApp = async (url, formData) => {
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    
    try {
      console.log("🔄 Trying direct POST to:", url);
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log("✅ Direct POST successful");
      return response;
    } catch (directError) {
      console.log("⚠️ Direct POST failed, trying with proxy...", directError.message);
      
      const response = await fetch(`${proxyUrl}${url}`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log("✅ Proxy POST successful");
      return response;
    }
  };

  const extractDownloadUrl = (html, baseUrl) => {
    console.log("🔍 Searching for download URL in HTML response...");
    
    const patterns = [
      /href="([^"]*\/get-file\/[^"]*)"[^>]*class="btn btn-primary btn-lg"/gi,
      /href="([^"]*\/get-file\/[^"]*)"/gi,
      /href="([^"]*\/download\/[^"]*\.xlsx?)"/gi,
      /href="([^"]*\/file\/[^"]*\.xlsx?)"/gi,
      /href="([^"]*[a-zA-Z0-9_-]+\.xlsx?)"/gi,
    ];
    
    let allMatches = [];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const matches = [...html.matchAll(pattern)];
      if (matches.length > 0) {
        console.log(`✅ Pattern ${i+1} found ${matches.length} matches:`, matches.map(m => m[1]));
        allMatches = allMatches.concat(matches.map(m => m[1]));
      }
    }
    
    if (allMatches.length > 0) {
      const validMatches = allMatches.filter(match => {
        const url = match.toLowerCase();
        return !url.includes('accept=') && 
               !url.includes('.xlsx,.xls') &&
               !url.includes('.xls,.xlsx') &&
               !url.startsWith('.') &&
               url.includes('.xls') &&
               (url.includes('/') || url.includes('http'));
      });
      
      console.log("🔍 Valid download URLs after filtering:", validMatches);
      
      for (const match of validMatches) {
        let downloadPath = match;
        console.log("🔍 Evaluating potential download path:", downloadPath);
        
        downloadPath = downloadPath.replace(/&amp;/g, '&');
        
        if (downloadPath.startsWith('/')) {
          downloadPath = baseUrl + downloadPath;
        } else if (!downloadPath.startsWith('http')) {
          downloadPath = baseUrl + '/' + downloadPath;
        }
        
        console.log("🔗 Final download URL candidate:", downloadPath);
        return downloadPath;
      }
    }
    
    console.log("❌ No download URL found.");
    return null;
  };
  
  const runWorkflow = async () => {
    if (!isReadyToStart()) return;
    
    setIsProcessing(true);
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
    
    let inventoryFile = null;
    let costingFile = null;
    let scoringFile = null;
    
    try {
      // Step 1: Program Inventory Agent
      setAgentStatus(prev => ({...prev, programInventory: 'running'}));
      console.log("🚀 Submitting to Program Inventory App...");
      
      try {
        const inventoryFormData = new FormData();
        inventoryFormData.append('file', files.personnel);
        inventoryFormData.append('department', orgName);
        inventoryFormData.append('website_url', files.website || '');
        inventoryFormData.append('programs_count', '5');
        
        console.log("📋 Form data being sent:");
        for (let [key, value] of inventoryFormData.entries()) {
          console.log(`  ${key}:`, value instanceof File ? value.name : value);
        }
        
        const inventoryResponse = await submitToApp(appUrls.programInventory, inventoryFormData);
        const inventoryHtml = await inventoryResponse.text();
        
        console.log("📥 Program Inventory Response received");
        console.log("🔗 Response URL:", inventoryResponse.url);
        
        let inventoryDownloadUrl = null;
        
        if (inventoryResponse.url.includes('/download/') || 
            inventoryResponse.url.includes('/get-file/') ||
            inventoryResponse.url.includes('.xlsx') ||
            inventoryResponse.url.includes('.xls')) {
          inventoryDownloadUrl = inventoryResponse.url;
          console.log("✅ Using response URL as download URL:", inventoryDownloadUrl);
        } else {
          console.log("🔍 Response URL is not a direct download, searching HTML...");
          inventoryDownloadUrl = extractDownloadUrl(inventoryHtml, appUrls.programInventory);
          
          if (!inventoryDownloadUrl) {
            console.log("🔍 Trying aggressive URL search in HTML...");
            console.log("📄 Full HTML length:", inventoryHtml.length);
            console.log("📄 HTML contains 'get-file':", inventoryHtml.includes('get-file'));
            console.log("📄 HTML contains 'download':", inventoryHtml.includes('download'));
            console.log("📄 HTML contains 'success':", inventoryHtml.includes('success'));
            console.log("📄 HTML contains 'generated':", inventoryHtml.includes('generated'));
            console.log("📄 HTML contains 'Programs':", inventoryHtml.includes('Programs'));
            console.log("📄 First 1000 chars of HTML:", inventoryHtml.substring(0, 1000));
            console.log("📄 Last 500 chars of HTML:", inventoryHtml.substring(inventoryHtml.length - 500));
            
            // Look for any form or error messages
            if (inventoryHtml.includes('error') || inventoryHtml.includes('Error')) {
              console.log("⚠️ HTML contains error messages");
            }
            
            if (inventoryHtml.includes('form') || inventoryHtml.includes('Form')) {
              console.log("⚠️ HTML still contains form - might not have processed correctly");
            }
            
            // Super aggressive search - look for ANY mention of get-file
            const allGetFileMatches = inventoryHtml.match(/get-file[^"'\s<>]*/gi);
            console.log("🔍 All get-file matches:", allGetFileMatches);
            
            // Look for href patterns with get-file
            const hrefMatches = inventoryHtml.match(/href="[^"]*get-file[^"]*"/gi);
            console.log("🔍 All href get-file matches:", hrefMatches);
            
            // Look for the exact Bootstrap button pattern
            const buttonMatches = inventoryHtml.match(/btn btn-primary btn-lg[^>]*>/gi);
            console.log("🔍 Bootstrap button matches:", buttonMatches);
            
            // Try to find any .xlsx file references
            const xlsxMatches = inventoryHtml.match(/[^"'\s<>]*\.xlsx[^"'\s<>]*/gi);
            console.log("🔍 All .xlsx matches:", xlsxMatches);
            
            // Most aggressive - just look for anything that might be a download URL
            if (hrefMatches && hrefMatches.length > 0) {
              const firstHref = hrefMatches[0];
              const urlMatch = firstHref.match(/href="([^"]*)"/);
              if (urlMatch) {
                inventoryDownloadUrl = urlMatch[1];
                if (inventoryDownloadUrl.startsWith('/')) {
                  inventoryDownloadUrl = appUrls.programInventory.replace(/\/$/, '') + inventoryDownloadUrl;
                }
                console.log("✅ Found get-file URL from href:", inventoryDownloadUrl);
              }
            }
            
            // If still nothing, try the simple get-file pattern
            if (!inventoryDownloadUrl && allGetFileMatches && allGetFileMatches.length > 0) {
              inventoryDownloadUrl = appUrls.programInventory.replace(/\/$/, '') + '/' + allGetFileMatches[0];
              console.log("✅ Constructed URL from get-file match:", inventoryDownloadUrl);
            }
          }
        }
        
        if (inventoryDownloadUrl) {
          console.log("✅ Program Inventory Download URL found:", inventoryDownloadUrl);
          
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
        const costFormData = new FormData();
        costFormData.append('program_inventory', inventoryFile);
        costFormData.append('department_budget', files.departmentBudget);
        costFormData.append('organization_name', orgName);
        
        const costResponse = await submitToApp(appUrls.costAllocation, costFormData);
        const costHtml = await costResponse.text();
        
        console.log("📥 Cost Allocation Response received");
        
        let costDownloadUrl = null;
        if (costResponse.url.includes('/download/') || 
            costResponse.url.includes('/get-file/') ||
            costResponse.url.includes('.xlsx') ||
            costResponse.url.includes('.xls')) {
          costDownloadUrl = costResponse.url;
        } else {
          costDownloadUrl = extractDownloadUrl(costHtml, appUrls.costAllocation);
          
          if (!costDownloadUrl) {
            const getFileMatch = costHtml.match(/\/get-file\/[^"'\s<>]+/i);
            if (getFileMatch) {
              costDownloadUrl = appUrls.costAllocation + getFileMatch[0];
            }
          }
        }
        
        if (costDownloadUrl) {
          console.log("✅ Cost Allocation Download URL found:", costDownloadUrl);
          
          const fileResponse = await fetch(costDownloadUrl);
          if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.status}`);
          }
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
        const scoringFormData = new FormData();
        scoringFormData.append('file', costingFile);
        scoringFormData.append('organization_name', orgName);
        
        const scoringResponse = await submitToApp(appUrls.programScoring, scoringFormData);
        const scoringHtml = await scoringResponse.text();
        
        console.log("📥 Program Scoring Response received");
        
        let scoringDownloadUrl = null;
        if (scoringResponse.url.includes('/download/') || 
            scoringResponse.url.includes('/get-file/') ||
            scoringResponse.url.includes('.xlsx') ||
            scoringResponse.url.includes('.xls')) {
          scoringDownloadUrl = scoringResponse.url;
        } else {
          scoringDownloadUrl = extractDownloadUrl(scoringHtml, appUrls.programScoring);
          
          if (!scoringDownloadUrl) {
            const getFileMatch = scoringHtml.match(/\/get-file\/[^"'\s<>]+/i);
            if (getFileMatch) {
              scoringDownloadUrl = appUrls.programScoring + getFileMatch[0];
            }
          }
        }
        
        if (scoringDownloadUrl) {
          console.log("✅ Program Scoring Download URL found:", scoringDownloadUrl);
          
          const fileResponse = await fetch(scoringDownloadUrl);
          if (!fileResponse.ok) {
            throw new Error(`Failed to download file: ${fileResponse.status}`);
          }
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
        const insightFormData = new FormData();
        insightFormData.append('file', scoringFile);
        insightFormData.append('organization_name', orgName);
        
        const insightResponse = await submitToApp(appUrls.programInsight, insightFormData);
        const insightHtml = await insightResponse.text();
        
        console.log("📥 Program Insight Response received");
        
        let insightDownloadUrl = null;
        if (insightResponse.url.includes('/download/') || 
            insightResponse.url.includes('/get-file/') ||
            insightResponse.url.includes('.xlsx') ||
            insightResponse.url.includes('.xls')) {
          insightDownloadUrl = insightResponse.url;
        } else {
          insightDownloadUrl = extractDownloadUrl(insightHtml, appUrls.programInsight);
          
          if (!insightDownloadUrl) {
            const getFileMatch = insightHtml.match(/\/get-file\/[^"'\s<>]+/i);
            if (getFileMatch) {
              insightDownloadUrl = appUrls.programInsight + getFileMatch[0];
            }
          }
        }
        
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
      
      setCurrentStep(4);
      console.log("🎉 All workflows completed successfully!");
      
    } catch (error) {
      console.error("❌ Workflow error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

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

        <div className="space-y-6">
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
          </a>
        </div>
      </div>
    </div>
  );
};

export default PBBWorkflowOrchestrator;