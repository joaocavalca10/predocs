<?php

/**
 * Função para printar algo na tela
 *
 * @param any $data
 * @return string
 */
function pr($data)
{
	echo '<pre>' . print_r($data, true) . '</pre>';
}

/**
 * Função para listar os arquivos de uma pasta
 *
 * @param string $path - caminho da lista de pastas
 * @return array - arry com os nomes dos arquivos/pastas de dentro do diretorio
 */
function listarArquivos(string $path = '/')
{
	$diretorio = dir($path);
	$arquivos = [];
	while ($arquivo = $diretorio->read()) {
		$arquivos[] = $arquivo;
	}
	$diretorio->close();
	return $arquivos;
}
