import { useState } from 'react'
import { Upload, BarChart3, Database, Brain } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Dataset {
  dataset_id: string
  filename?: string
  rows: number
  columns: string[]
  dtypes?: Record<string, string>
  preview?: any[]
  statistics?: any
}

interface AnalysisResult {
  [key: string]: any
}

function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [targetColumn, setTargetColumn] = useState<string>('')

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Upload failed')

      const data = await response.json()
      setDatasets([...datasets, data])
      setSelectedDataset(data)
    } catch (err) {
      setError('Failed to upload file. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const runAnalysis = async (analysisType: string) => {
    if (!selectedDataset) return

    setAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      const body: any = {
        dataset_id: selectedDataset.dataset_id,
        analysis_type: analysisType,
      }

      if (analysisType === 'regression' || analysisType === 'classification') {
        if (!targetColumn || selectedColumns.length === 0) {
          setError('Please select target and feature columns')
          setAnalyzing(false)
          return
        }
        body.target_column = targetColumn
        body.feature_columns = selectedColumns
      }

      const response = await fetch(`${API_URL}/api/analyze/${analysisType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Analysis failed')

      const data = await response.json()
      setAnalysisResult(data)
    } catch (err) {
      setError(`Failed to run ${analysisType} analysis. Please try again.`)
    } finally {
      setAnalyzing(false)
    }
  }

  const getCorrelationData = () => {
    if (!analysisResult?.correlations) return []
    
    const correlations = analysisResult.correlations
    const columns = Object.keys(correlations)
    const data: any[] = []
    
    columns.forEach((col1, i) => {
      columns.forEach((col2, j) => {
        if (i < j) {
          data.push({
            pair: `${col1} vs ${col2}`,
            correlation: correlations[col1][col2]
          })
        }
      })
    })
    
    return data.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 10)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Brain className="w-10 h-10 text-blue-600" />
            AI Data Scientist
          </h1>
          <p className="text-slate-600">Upload datasets and perform advanced AI-powered analysis</p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Dataset
              </CardTitle>
              <CardDescription>Upload a CSV file to begin analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-upload">Select CSV File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="mt-2"
                  />
                </div>
                {uploading && <p className="text-sm text-slate-600">Uploading...</p>}
                
                {datasets.length > 0 && (
                  <div className="space-y-2">
                    <Label>Available Datasets</Label>
                    {datasets.map((ds) => (
                      <Button
                        key={ds.dataset_id}
                        variant={selectedDataset?.dataset_id === ds.dataset_id ? 'default' : 'outline'}
                        className="w-full justify-start"
                        onClick={() => setSelectedDataset(ds)}
                      >
                        <Database className="w-4 h-4 mr-2" />
                        {ds.filename || ds.dataset_id} ({ds.rows} rows)
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Dataset Overview</CardTitle>
              <CardDescription>
                {selectedDataset ? `${selectedDataset.rows} rows × ${selectedDataset.columns.length} columns` : 'No dataset selected'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDataset ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Columns</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedDataset.columns.map((col) => (
                        <Badge key={col} variant="secondary">
                          {col}
                          {selectedDataset.dtypes && (
                            <span className="ml-1 text-xs opacity-70">
                              ({selectedDataset.dtypes[col]})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {selectedDataset.preview && (
                    <div>
                      <h3 className="font-semibold mb-2">Data Preview</h3>
                      <div className="border rounded-lg overflow-auto max-h-64">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {selectedDataset.columns.slice(0, 6).map((col) => (
                                <TableHead key={col}>{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedDataset.preview.slice(0, 5).map((row, idx) => (
                              <TableRow key={idx}>
                                {selectedDataset.columns.slice(0, 6).map((col) => (
                                  <TableCell key={col}>{String(row[col])}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">Upload a dataset to get started</p>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedDataset && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Analysis Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="descriptive" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="descriptive">Descriptive</TabsTrigger>
                  <TabsTrigger value="regression">Regression</TabsTrigger>
                  <TabsTrigger value="classification">Classification</TabsTrigger>
                  <TabsTrigger value="outliers">Outliers</TabsTrigger>
                </TabsList>

                <TabsContent value="descriptive" className="space-y-4">
                  <div>
                    <Button onClick={() => runAnalysis('descriptive')} disabled={analyzing}>
                      {analyzing ? 'Analyzing...' : 'Run Descriptive Analysis'}
                    </Button>
                  </div>
                  
                  {analysisResult && analysisResult.summary_statistics && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold mb-3">Summary Statistics</h3>
                        <div className="border rounded-lg overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Metric</TableHead>
                                {Object.keys(analysisResult.summary_statistics).slice(0, 5).map((col) => (
                                  <TableHead key={col}>{col}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {['count', 'mean', 'std', 'min', 'max'].map((stat) => (
                                <TableRow key={stat}>
                                  <TableCell className="font-medium">{stat}</TableCell>
                                  {Object.keys(analysisResult.summary_statistics).slice(0, 5).map((col) => (
                                    <TableCell key={col}>
                                      {analysisResult.summary_statistics[col][stat]?.toFixed(2) || 'N/A'}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {analysisResult.correlations && Object.keys(analysisResult.correlations).length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-3">Top Correlations</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={getCorrelationData()}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="pair" angle={-45} textAnchor="end" height={100} />
                              <YAxis domain={[-1, 1]} />
                              <Tooltip />
                              <Bar dataKey="correlation" fill="#3b82f6" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="regression" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Target Column</Label>
                      <Select value={targetColumn} onValueChange={setTargetColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedDataset.columns.map((col) => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Feature Columns (comma-separated)</Label>
                      <Input
                        placeholder="col1,col2,col3"
                        onChange={(e) => setSelectedColumns(e.target.value.split(',').map(s => s.trim()))}
                      />
                    </div>
                  </div>
                  
                  <Button onClick={() => runAnalysis('regression')} disabled={analyzing}>
                    {analyzing ? 'Analyzing...' : 'Run Regression Analysis'}
                  </Button>

                  {analysisResult && analysisResult.metrics && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">R² Score</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{analysisResult.metrics.r2_score?.toFixed(4)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">RMSE</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{analysisResult.metrics.rmse?.toFixed(4)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">MSE</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{analysisResult.metrics.mse?.toFixed(4)}</p>
                          </CardContent>
                        </Card>
                      </div>

                      {analysisResult.coefficients && (
                        <div>
                          <h3 className="font-semibold mb-3">Feature Coefficients</h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={Object.entries(analysisResult.coefficients).map(([k, v]) => ({ name: k, value: v }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="value" fill="#10b981" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {analysisResult.predictions && (
                        <div>
                          <h3 className="font-semibold mb-3">Predictions vs Actual</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <ScatterChart>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="actual" name="Actual" />
                              <YAxis dataKey="predicted" name="Predicted" />
                              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                              <Scatter
                                name="Predictions"
                                data={analysisResult.predictions.actual.map((a: number, i: number) => ({
                                  actual: a,
                                  predicted: analysisResult.predictions.predicted[i]
                                }))}
                                fill="#8b5cf6"
                              />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="classification" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Target Column</Label>
                      <Select value={targetColumn} onValueChange={setTargetColumn}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedDataset.columns.map((col) => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Feature Columns (comma-separated)</Label>
                      <Input
                        placeholder="col1,col2,col3"
                        onChange={(e) => setSelectedColumns(e.target.value.split(',').map(s => s.trim()))}
                      />
                    </div>
                  </div>
                  
                  <Button onClick={() => runAnalysis('classification')} disabled={analyzing}>
                    {analyzing ? 'Analyzing...' : 'Run Classification Analysis'}
                  </Button>

                  {analysisResult && analysisResult.metrics && (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Model Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-center">
                            <p className="text-sm text-slate-600 mb-2">Accuracy</p>
                            <p className="text-4xl font-bold text-green-600">
                              {(analysisResult.metrics.accuracy * 100).toFixed(2)}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {analysisResult.feature_importance && (
                        <div>
                          <h3 className="font-semibold mb-3">Feature Importance</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={Object.entries(analysisResult.feature_importance).map(([k, v]) => ({ name: k, importance: v }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="importance" fill="#f59e0b" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="outliers" className="space-y-4">
                  <Button onClick={() => runAnalysis('outliers')} disabled={analyzing}>
                    {analyzing ? 'Analyzing...' : 'Detect Outliers'}
                  </Button>

                  {analysisResult && analysisResult.outliers_by_column && (
                    <div>
                      <h3 className="font-semibold mb-3">Outliers by Column (Z-score &gt; 3)</h3>
                      <div className="border rounded-lg overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Column</TableHead>
                              <TableHead>Outlier Count</TableHead>
                              <TableHead>Percentage</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(analysisResult.outliers_by_column).map(([col, data]: [string, any]) => (
                              <TableRow key={col}>
                                <TableCell className="font-medium">{col}</TableCell>
                                <TableCell>{data.count}</TableCell>
                                <TableCell>{data.percentage.toFixed(2)}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default App
