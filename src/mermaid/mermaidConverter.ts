export async function convertMermaidToSVG(mermaidCode: string): Promise<string> {
    const mermaid = await import('mermaid');

    // Ensure mermaid is initialized
    await mermaid.default.initialize({ startOnLoad: false });

    const { svg } = await mermaid.default.render('svgGraph', mermaidCode);
    return svg;
}
