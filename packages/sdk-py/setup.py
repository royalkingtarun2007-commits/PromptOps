from setuptools import setup, find_packages # type: ignore

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="promptops",
    version="0.1.0",
    author="PromptOps Contributors",
    description="Git for Prompts — version control, A/B testing, and CI/CD for your LLM prompts",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-username/promptops",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Software Development :: Libraries",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.9",
    install_requires=[
        "httpx>=0.25.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "respx>=0.20.0",
        ]
    },
)