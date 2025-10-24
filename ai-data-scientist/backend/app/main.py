from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, classification_report
import io
import json
from typing import Optional, Dict, Any, List

app = FastAPI()

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

data_store = {}

class AnalysisRequest(BaseModel):
    dataset_id: str
    analysis_type: str
    target_column: Optional[str] = None
    feature_columns: Optional[List[str]] = None
    parameters: Optional[Dict[str, Any]] = None

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        dataset_id = f"dataset_{len(data_store) + 1}"
        data_store[dataset_id] = df
        
        return {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "rows": len(df),
            "columns": list(df.columns),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "preview": df.head(10).to_dict(orient='records')
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

@app.get("/api/datasets")
async def list_datasets():
    return {
        "datasets": [
            {
                "id": dataset_id,
                "rows": len(df),
                "columns": list(df.columns)
            }
            for dataset_id, df in data_store.items()
        ]
    }

@app.get("/api/dataset/{dataset_id}")
async def get_dataset(dataset_id: str):
    if dataset_id not in data_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    df = data_store[dataset_id]
    return {
        "dataset_id": dataset_id,
        "rows": len(df),
        "columns": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "preview": df.head(10).to_dict(orient='records'),
        "statistics": df.describe().to_dict()
    }

@app.post("/api/analyze/descriptive")
async def descriptive_analysis(request: AnalysisRequest):
    if request.dataset_id not in data_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    df = data_store[request.dataset_id]
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
    
    result = {
        "summary_statistics": df.describe().to_dict(),
        "missing_values": df.isnull().sum().to_dict(),
        "data_types": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "correlations": df[numeric_cols].corr().to_dict() if numeric_cols else {}
    }
    
    return result

@app.post("/api/analyze/regression")
async def regression_analysis(request: AnalysisRequest):
    if request.dataset_id not in data_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not request.target_column or not request.feature_columns:
        raise HTTPException(status_code=400, detail="Target and feature columns required")
    
    df = data_store[request.dataset_id]
    
    try:
        X = df[request.feature_columns].select_dtypes(include=[np.number])
        y = df[request.target_column]
        
        X = X.fillna(X.mean())
        y = y.fillna(y.mean())
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        
        mse = mean_squared_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        return {
            "model_type": "Linear Regression",
            "metrics": {
                "mse": float(mse),
                "rmse": float(np.sqrt(mse)),
                "r2_score": float(r2)
            },
            "coefficients": {col: float(coef) for col, coef in zip(request.feature_columns, model.coef_)},
            "intercept": float(model.intercept_),
            "predictions": {
                "actual": y_test.tolist()[:20],
                "predicted": y_pred.tolist()[:20]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Regression analysis failed: {str(e)}")

@app.post("/api/analyze/classification")
async def classification_analysis(request: AnalysisRequest):
    if request.dataset_id not in data_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not request.target_column or not request.feature_columns:
        raise HTTPException(status_code=400, detail="Target and feature columns required")
    
    df = data_store[request.dataset_id]
    
    try:
        X = df[request.feature_columns].select_dtypes(include=[np.number])
        y = df[request.target_column]
        
        X = X.fillna(X.mean())
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        
        accuracy = accuracy_score(y_test, y_pred)
        
        feature_importance = {col: float(imp) for col, imp in zip(request.feature_columns, model.feature_importances_)}
        
        return {
            "model_type": "Random Forest Classifier",
            "metrics": {
                "accuracy": float(accuracy)
            },
            "feature_importance": feature_importance,
            "predictions": {
                "actual": y_test.tolist()[:20],
                "predicted": y_pred.tolist()[:20]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Classification analysis failed: {str(e)}")

@app.post("/api/analyze/outliers")
async def outlier_detection(request: AnalysisRequest):
    if request.dataset_id not in data_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    df = data_store[request.dataset_id]
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    outliers = {}
    for col in numeric_cols:
        col_data = df[col].dropna()
        mean = col_data.mean()
        std = col_data.std()
        z_scores = np.abs((col_data - mean) / std)
        outlier_indices = np.where(z_scores > 3)[0].tolist()
        outliers[col] = {
            "count": len(outlier_indices),
            "percentage": float(len(outlier_indices) / len(df) * 100)
        }
    
    return {
        "outliers_by_column": outliers,
        "total_rows": len(df)
    }

@app.post("/api/visualize/distribution")
async def distribution_data(request: AnalysisRequest):
    if request.dataset_id not in data_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    df = data_store[request.dataset_id]
    
    if request.target_column:
        column = request.target_column
        if column not in df.columns:
            raise HTTPException(status_code=400, detail="Column not found")
        
        if df[column].dtype in [np.number, 'int64', 'float64']:
            hist, bin_edges = np.histogram(df[column].dropna(), bins=20)
            return {
                "type": "numeric",
                "histogram": {
                    "counts": hist.tolist(),
                    "bins": bin_edges.tolist()
                },
                "statistics": {
                    "mean": float(df[column].mean()),
                    "median": float(df[column].median()),
                    "std": float(df[column].std()),
                    "min": float(df[column].min()),
                    "max": float(df[column].max())
                }
            }
        else:
            value_counts = df[column].value_counts().head(20)
            return {
                "type": "categorical",
                "value_counts": value_counts.to_dict()
            }
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    return {
        "available_columns": numeric_cols
    }
